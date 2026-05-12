declare module "minimatch" {
  export interface IOptions {
    noglobstar?: boolean;
    dot?: boolean;
    nocase?: boolean;
    matchBase?: boolean;
    nocomment?: boolean;
    nonegate?: boolean;
    flipNegate?: boolean;
  }

  export interface Minimatch {
    pattern: string;
    options: IOptions;
    makeRe(): RegExp;
    match(str: string): boolean;
  }

  function minimatch(target: string, pattern: string, options?: IOptions): boolean;

  namespace minimatch {
    const Minimatch: {
      new (pattern: string, options?: IOptions): Minimatch;
    };
  }

  export = minimatch;
}
