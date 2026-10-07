using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

// PHP owns the policy. This adapter only speaks SCM, checks ACLs, and contains children.
internal sealed class DaemonHost : ServiceBase
{
    private Process child;
    private IntPtr job;
    private string stopFile;
    private string logFile;
    private volatile bool stopping;
    private readonly object logLock = new object();
    private readonly string settingsFile;
    private readonly bool console;

    private DaemonHost(string file, bool foreground)
    {
        ServiceName = "lattice-daemon";
        CanStop = true;
        CanShutdown = true;
        AutoLog = false;
        settingsFile = Path.GetFullPath(file);
        console = foreground;
    }

    private static int Main(string[] args)
    {
        try {
            if (args.Length == 3 && args[0] == "--check-private") {
                Console.WriteLine(CheckPath(args[1], args[2] == "directory", true, false));
                return 0;
            }
            if (args.Length == 2 && args[0] == "--check-code") {
                CheckTree(args[1], true);
                return 0;
            }
            if (args.Length == 1 && args[0] == "--self-test") {
                if (Quote("a b\\") != "\"a b\\\\\"" || Quote("a\"b") != "\"a\\\"b\"") throw new Exception("Argument quoting failed.");
                Console.WriteLine("Windows service host ready.");
                return 0;
            }
            bool foreground = args.Length == 2 && args[0] == "--console";
            if (!foreground && args.Length != 0) throw new Exception("Usage: daemon-host.exe [--console service.json]");
            string file = foreground ? args[1] : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "service.json");
            using (var host = new DaemonHost(file, foreground)) {
                if (foreground) {
                    Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e) { e.Cancel = true; host.stopping = true; };
                    host.OnStart(new string[0]);
                    while (!host.stopping && !host.child.HasExited && !File.Exists(host.stopFile)) Thread.Sleep(100);
                    host.OnStop();
                } else { Run(host); }
            }
            return 0;
        } catch (Exception error) { Console.Error.WriteLine("daemon host: " + error.Message); return 1; }
    }

    private static bool Trusted(string sid, bool strict)
    {
        return sid == "S-1-5-18" || sid == "S-1-5-32-544"
            || sid == "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"
            || (!strict && sid == WindowsIdentity.GetCurrent().User.Value);
    }

    internal static string CheckPath(string path, bool directory, bool privacy, bool strict)
    {
        string full = Path.GetFullPath(path);
        string current = full;
        bool leaf = true;
        while (current != null) {
            FileAttributes attributes = File.GetAttributes(current);
            bool isDirectory = (attributes & FileAttributes.Directory) != 0;
            if ((attributes & FileAttributes.ReparsePoint) != 0 || (leaf && isDirectory != directory))
                throw new Exception("Daemon paths cannot contain reparse points or unexpected file types: " + current);
            FileSystemSecurity acl = isDirectory ? (FileSystemSecurity)Directory.GetAccessControl(current) : File.GetAccessControl(current);
            if (!Trusted(acl.GetOwner(typeof(SecurityIdentifier)).Value, strict))
                throw new Exception("Daemon paths require a trusted owner: " + current);
            // Creating a sibling is harmless; deleting/replacing an ancestor isn't.
            FileSystemRights dangerous = FileSystemRights.Delete | FileSystemRights.DeleteSubdirectoriesAndFiles
                | FileSystemRights.ChangePermissions | FileSystemRights.TakeOwnership | (FileSystemRights)0x10000000;
            if (leaf) dangerous |= FileSystemRights.WriteData | FileSystemRights.AppendData | FileSystemRights.WriteAttributes
                | FileSystemRights.WriteExtendedAttributes | (FileSystemRights)0x40000000;
            foreach (FileSystemAccessRule rule in acl.GetAccessRules(true, true, typeof(SecurityIdentifier))) {
                if (rule.AccessControlType != AccessControlType.Allow || (rule.PropagationFlags & PropagationFlags.InheritOnly) != 0) continue;
                if (!Trusted(rule.IdentityReference.Value, strict)
                    && ((leaf && privacy && rule.FileSystemRights != 0) || (rule.FileSystemRights & dangerous) != 0))
                    throw new Exception("Daemon path grants access to an untrusted account: " + current);
            }
            current = Path.GetDirectoryName(current);
            leaf = false;
        }
        return full;
    }

    private static void CheckTree(string path, bool strict)
    {
        bool directory = Directory.Exists(path);
        CheckPath(path, directory, false, strict);
        if (directory) foreach (string childPath in Directory.GetFileSystemEntries(path)) CheckTree(childPath, strict);
    }

    private static Dictionary<string, object> ReadJson(string path)
    {
        if (new FileInfo(path).Length > 65536) throw new Exception("Service configuration is too large.");
        return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(path));
    }

    private static string Value(Dictionary<string, object> settings, string key)
    {
        object value;
        if (!settings.TryGetValue(key, out value) || !(value is string) || String.IsNullOrWhiteSpace((string)value))
            throw new Exception("Missing service setting: " + key);
        return (string)value;
    }

    // CommandLineToArgvW-compatible quoting. Never send paths through cmd.exe.
    private static string Quote(string value)
    {
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            result.Append('\\', c == '"' ? slashes * 2 + 1 : slashes);
            result.Append(c);
            slashes = 0;
        }
        result.Append('\\', slashes * 2);
        return result.Append('"').ToString();
    }

    protected override void OnStart(string[] args)
    {
        CheckPath(settingsFile, false, true, !console);
        var settings = ReadJson(settingsFile);
        string php = CheckPath(Value(settings, "php"), false, false, !console);
        CheckPath(Path.GetDirectoryName(php), true, false, !console);
        string config = CheckPath(Value(settings, "config"), false, true, !console);
        var daemon = ReadJson(config);
        string state = CheckPath(Value(daemon, "state_dir"), true, true, !console);
        string checkout = CheckPath(Value(daemon, "directory"), true, false, !console);
        string runtime = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        if (!console) { CheckTree(runtime, true); CheckTree(checkout, true); }
        string dockerDirectory = CheckPath(Value(settings, "docker_directory"), true, false, !console);
        string gitDirectory = CheckPath(Value(settings, "git_directory"), true, false, !console);
        CheckPath(Path.Combine(dockerDirectory, "docker.exe"), false, false, !console);
        CheckPath(Path.Combine(gitDirectory, "git.exe"), false, false, !console);
        string dockerHost = Value(settings, "docker_host");
        if (!dockerHost.StartsWith("npipe:////./pipe/", StringComparison.Ordinal) || dockerHost.IndexOfAny(new[] {'\r', '\n', '\0'}) >= 0)
            throw new Exception("Windows daemon requires an explicit local Docker named pipe.");
        string token = Guid.NewGuid().ToString("N");
        stopFile = Path.Combine(state, "stop-" + token);
        logFile = Path.Combine(state, "daemon.log");
        var start = new ProcessStartInfo(php, Quote(Path.Combine(runtime, "bin", "daemon")) + " watch --config " + Quote(config) + " --stop-token " + token);
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.WorkingDirectory = runtime;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;
        start.EnvironmentVariables["PATH"] = dockerDirectory + ";" + gitDirectory + ";" + Path.GetDirectoryName(php) + ";" + Environment.GetFolderPath(Environment.SpecialFolder.System);
        start.EnvironmentVariables["DOCKER_HOST"] = dockerHost;
        start.EnvironmentVariables.Remove("DOCKER_CONTEXT");
        start.EnvironmentVariables.Remove("DOCKER_TLS_VERIFY");
        start.EnvironmentVariables.Remove("DOCKER_CERT_PATH");
        start.EnvironmentVariables["DOCKER_CONFIG"] = Path.Combine(state, "docker");
        start.EnvironmentVariables["GIT_TERMINAL_PROMPT"] = "0";
        start.EnvironmentVariables["GIT_CONFIG_COUNT"] = "1";
        start.EnvironmentVariables["GIT_CONFIG_KEY_0"] = "safe.directory";
        start.EnvironmentVariables["GIT_CONFIG_VALUE_0"] = checkout.Replace('\\', '/');
        start.EnvironmentVariables["NO_COLOR"] = "1";
        start.EnvironmentVariables["TEMP"] = Path.Combine(state, "tmp");
        start.EnvironmentVariables["TMP"] = start.EnvironmentVariables["TEMP"];
        Directory.CreateDirectory(start.EnvironmentVariables["TEMP"]);
        Directory.CreateDirectory(start.EnvironmentVariables["DOCKER_CONFIG"]);
        job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Exception("Cannot create service process job.");
        var limits = new JobLimits();
        limits.BasicLimitInformation.LimitFlags = 0x2000; // Kill descendants if the host disappears.
        if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) throw new Exception("Cannot contain service processes.");
        child = new Process(); child.StartInfo = start;
        child.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Log(e.Data); };
        child.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Log(e.Data); };
        child.Start();
        if (!AssignProcessToJobObject(job, child.Handle)) { child.Kill(); throw new Exception("Cannot attach PHP to service process job."); }
        child.BeginOutputReadLine(); child.BeginErrorReadLine();
        Log("daemon service started; stop file: " + stopFile);
        ThreadPool.QueueUserWorkItem(delegate {
            child.WaitForExit();
            if (!stopping) { Log("PHP exited unexpectedly; requesting service recovery."); Environment.Exit(1); }
        });
    }

    private void Log(string message)
    {
        lock (logLock) {
            try {
                if (File.Exists(logFile) && new FileInfo(logFile).Length >= 10 * 1024 * 1024) {
                    if (File.Exists(logFile + ".3")) File.Delete(logFile + ".3");
                    for (int i = 2; i >= 1; i--) if (File.Exists(logFile + "." + i)) File.Move(logFile + "." + i, logFile + "." + (i + 1));
                    File.Move(logFile, logFile + ".1");
                }
                File.AppendAllText(logFile, message + Environment.NewLine, new UTF8Encoding(false));
                if (console) Console.WriteLine(message);
            } catch { Environment.Exit(1); }
        }
    }

    protected override void OnStop()
    {
        stopping = true;
        if (child == null) return;
        if (!child.HasExited) {
            using (File.Open(stopFile, FileMode.OpenOrCreate, FileAccess.Write, FileShare.Read)) { }
            var timer = Stopwatch.StartNew();
            while (!child.WaitForExit(1000)) {
                if (!console) RequestAdditionalTime(10000);
                if (timer.Elapsed.TotalSeconds >= 3600) { Log("Graceful stop timed out; interrupted updates remain blocked."); Environment.Exit(1); }
            }
        }
        child.WaitForExit();
        File.Delete(stopFile);
        if (job != IntPtr.Zero) { CloseHandle(job); job = IntPtr.Zero; }
        Log("daemon service stopped; containers left running.");
    }

    protected override void OnShutdown() { OnStop(); }

    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong A, B, C, D, E, F; }
    [StructLayout(LayoutKind.Sequential)] private struct JobLimits {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")] private static extern bool SetInformationJobObject(IntPtr job, int info, ref JobLimits limits, uint length);
    [DllImport("kernel32.dll")] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
