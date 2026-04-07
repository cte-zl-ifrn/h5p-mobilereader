declare module 'h5p-standalone' {
  export function H5PStandalone(
    element: HTMLElement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any
  ): Promise<void>;
}
