declare module 'screenshot-desktop' {
  function screenshot(): Promise<Buffer>;
  function screenshot(options: { screen: number }): Promise<Buffer>;
  function screenshot(options: { filename: string }): Promise<string>;
  function screenshot(options: { screen: number; filename: string }): Promise<string>;
  
  namespace screenshot {
    function all(): Promise<Buffer[]>;
    function listDisplays(): Promise<{ id: number; name: string }[]>;
  }
  
  export = screenshot;
} 