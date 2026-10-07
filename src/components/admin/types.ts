import type { Role } from "@/shared/types";
export interface Member{id:string;name:string;email:string;username:string;role:Role;joined_at:string}
export interface Group{id:string;name:string;members:string[]}
export interface Grant{id:string;page_id:string|null;collection_id:string|null;group_id:string|null;user_id:string|null;capability:string}
export interface AdminData{members:Member[];groups:Group[];permissions:Grant[];invites:{id:string;email:string;role:string;expires_at:string;accepted_at:string|null}[];storage:{count:string;bytes:string};system:{version:string;database:string;storage:string;authentication:string}}
