
declare module 'bcryptjs' {
    export function hash(password: string, saltRounds?: number): string;
    export function compare(password: string, hash: string): boolean;
}