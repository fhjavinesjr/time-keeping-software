declare module 'jsonwebtoken' {
    // Add type definitions for the specific functions and types you use
    // For example:
    interface SignOptions {
        expiresIn?: string | number;
        notBefore?: string | number;
        audience?: string | string[];
        issuer?: string;
        jwtid?: string;
        subject?: string;
        noTimestamp?: boolean;
        header?: object;
        keyid?: string;
        mutatePayload?: boolean;
    }

    function sign(payload: object, secretOrPrivateKey: string | Buffer, options?: SignOptions): string;
    function verify(token: string, secretOrPublicKey: string | Buffer): string;
    // ... other types and functions as needed
  }