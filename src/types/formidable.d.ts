//adding config to access and use the formidable, Fields and Files keyword
declare module "formidable" {
  export type Fields = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  export type Files = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  export default function formidable(): {
    parse: (
      req: any, // eslint-disable-line @typescript-eslint/no-explicit-any
      callback: (err: Error | null, fields: Fields, files: Files) => void
    ) => void;
  };
}
