declare module "picomatch" {
  interface PicomatchOptions {
    dot?: boolean;
    nocase?: boolean;
  }

  function picomatch(pattern: string, options?: PicomatchOptions): (path: string) => boolean;
  export default picomatch;
}
