declare namespace NodeJS {
  export interface ProcessEnv {
    POSTMARK_KEY: string;
    CSRF_TOKEN: string;
    EMAIL_FROM: string;
    EMAIL_TO: string;
  }
}
