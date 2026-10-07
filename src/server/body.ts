import { AppError } from "./errors";
export async function readBytes(request: Request, maximum: number) {
  if(Number(request.headers.get("content-length"))>maximum) throw new AppError(413,"Request too large.");
  const reader=request.body?.getReader(); if(!reader) return new Uint8Array();
  const chunks:Uint8Array[]=[]; let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw new AppError(413,"Request too large.");}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function boundedRequest(request:Request,maximum=1048576){if(["GET","HEAD","DELETE"].includes(request.method))return request;const bytes=await readBytes(request,maximum);return new Request(request.url,{method:request.method,headers:request.headers,body:bytes});}
