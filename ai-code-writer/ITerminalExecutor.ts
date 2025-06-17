/**
 * Cross-platform terminal execution context enumeration
 * Defines the available execution environments for terminal commands
 */
export enum TerminalContext {
  /** Windows native command prompt/PowerShell */
  WINDOWS = 'windows',
  /** Windows Subsystem for Linux */
  WSL = 'wsl'
}

/**
 * Options for terminal command execution
 */
export interface TerminalExecutionOptions {
  /** Working directory for command execution (optional) */
  cwd?: string;
  
  /** Environment variables to set for the command */
  env?: Record<string, string>;
  
  /** Timeout in milliseconds for command execution */
  timeout?: number;
  
  /** Whether to capture stdout */
  captureStdout?: boolean;
  
  /** Whether to capture stderr */
  captureStderr?: boolean;
  
  /** Input to pipe to the command's stdin */
  input?: string;
  
  /** Shell to use for command execution */
  shell?: string;
  
  /** Whether to run command in detached mode */
  detached?: boolean;
}

/**
 * Rich error metadata for failed terminal operations
 */
export interface TerminalErrorMetadata {
  /** Original error message */
  message: string;
  
  /** Error code if available */
  code?: string | number;
  
  /** Signal that terminated the process (if applicable) */
  signal?: string;
  
  /** Whether the error was due to timeout */
  timedOut?: boolean;
  
  /** System error number (errno) */
  errno?: number;
  
  /** System call that failed */
  syscall?: string;
  
  /** Path related to the error (if applicable) */
  path?: string;
  
  /** Additional context about the error */
  context?: string;
  
  /** Stack trace if available */
  stack?: string;
  
  /** Timestamp when error occurred */
  timestamp: Date;
}

/**
 * Result object returned by terminal command execution
 */
export interface TerminalExecutionResult {
  /** Standard output from the command */
  stdout: string;
  
  /** Standard error output from the command */
  stderr: string;
  
  /** Exit code returned by the command */
  exitCode: number;
  
  /** Current working directory after command execution */
  cwd: string;
  
  /** Execution context used for the command */
  context: TerminalContext;
  
  /** Command that was executed */
  command: string;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Process ID of the executed command */
  pid?: number;
  
  /** Signal that terminated the process (if applicable) */
  signal?: string;
  
  /** Whether the command was killed due to timeout */
  timedOut?: boolean;
  
  /** Rich error metadata (only present if command failed) */
  error?: TerminalErrorMetadata;
  
  /** Timestamp when command started */
  startTime: Date;
  
  /** Timestamp when command completed */
  endTime: Date;
}

/**
 * Context information for terminal operations
 */
export interface TerminalContextInfo {
  /** Current context */
  context: TerminalContext;
  
  /** Current working directory in this context */
  cwd: string;
  
  /** Whether the context is currently available */
  available: boolean;
  
  /** Version information for the context */
  version?: string;
  
  /** Environment variables in this context */
  environment?: Record<string, string>;
  
  /** Shell being used in this context */
  shell?: string;
}

/**
 * Formal TypeScript interface for cross-platform terminal execution
 * Provides unified API for executing commands across Windows and WSL contexts
 */
export interface ITerminalExecutor {
  /**
   * Execute a terminal command in the specified or current context
   * 
   * @param cmd - Command string to execute
   * @param opts - Execution options including cwd, env, timeout, etc.
   * @returns Promise resolving to execution result with stdout, stderr, exit code, and metadata
   * 
   * @example
   * ```typescript
   * const result = await executor.exec('ls -la', { cwd: '/home/user' });
   * console.log(result.stdout);
   * ```
   */
  exec(cmd: string, opts?: TerminalExecutionOptions): Promise<TerminalExecutionResult>;
  
  /**
   * Set the current working directory for the specified context
   * 
   * @param path - Absolute or relative path to set as working directory
   * @param context - Terminal context to set the directory for
   * @returns Promise resolving to the absolute path that was set
   * 
   * @throws {Error} If path doesn't exist or is not accessible
   * 
   * @example
   * ```typescript
   * await executor.setCwd('/home/user/projects', TerminalContext.WSL);
   * ```
   */
  setCwd(path: string, context: TerminalContext): Promise<string>;
  
  /**
   * Get the current working directory for the specified context
   * 
   * @param context - Terminal context to get the directory from
   * @returns Promise resolving to the absolute path of current working directory
   * 
   * @example
   * ```typescript
   * const currentDir = await executor.getCwd(TerminalContext.WINDOWS);
   * console.log('Current directory:', currentDir);
   * ```
   */
  getCwd(context: TerminalContext): Promise<string>;
  
  /**
   * Switch the active terminal context for subsequent operations
   * 
   * @param context - Terminal context to switch to
   * @returns Promise resolving to context information after switch
   * 
   * @throws {Error} If context is not available or switch fails
   * 
   * @example
   * ```typescript
   * const contextInfo = await executor.switchContext(TerminalContext.WSL);
   * console.log('Switched to:', contextInfo.context);
   * ```
   */
  switchContext(context: TerminalContext): Promise<TerminalContextInfo>;
  
  /**
   * Get information about the current active context
   * 
   * @returns Promise resolving to current context information
   * 
   * @example
   * ```typescript
   * const info = await executor.getCurrentContext();
   * console.log('Current context:', info.context, 'CWD:', info.cwd);
   * ```
   */
  getCurrentContext(): Promise<TerminalContextInfo>;
  
  /**
   * Get information about all available contexts
   * 
   * @returns Promise resolving to array of context information
   * 
   * @example
   * ```typescript
   * const contexts = await executor.getAvailableContexts();
   * contexts.forEach(ctx => console.log(`${ctx.context}: ${ctx.available ? 'available' : 'unavailable'}`));
   * ```
   */
  getAvailableContexts(): Promise<TerminalContextInfo[]>;
  
  /**
   * Check if a specific context is available
   * 
   * @param context - Terminal context to check
   * @returns Promise resolving to boolean indicating availability
   * 
   * @example
   * ```typescript
   * const isWSLAvailable = await executor.isContextAvailable(TerminalContext.WSL);
   * if (!isWSLAvailable) {
   *   console.log('WSL is not available on this system');
   * }
   * ```
   */
  isContextAvailable(context: TerminalContext): Promise<boolean>;
  
  /**
   * Convert a path from one context to another (e.g., Windows path to WSL path)
   * 
   * @param path - Path to convert
   * @param fromContext - Source context
   * @param toContext - Target context
   * @returns Promise resolving to converted path
   * 
   * @example
   * ```typescript
   * const wslPath = await executor.convertPath('C:\\Users\\john', TerminalContext.WINDOWS, TerminalContext.WSL);
   * console.log(wslPath); // '/mnt/c/Users/john'
   * ```
   */
  convertPath(path: string, fromContext: TerminalContext, toContext: TerminalContext): Promise<string>;
  
  /**
   * Dispose of resources and cleanup
   * Should be called when the executor is no longer needed
   * 
   * @returns Promise resolving when cleanup is complete
   */
  dispose(): Promise<void>;
}

/**
 * Factory interface for creating terminal executor instances
 */
export interface ITerminalExecutorFactory {
  /**
   * Create a new terminal executor instance
   * 
   * @param defaultContext - Default context to use for operations
   * @returns Promise resolving to terminal executor instance
   */
  create(defaultContext?: TerminalContext): Promise<ITerminalExecutor>;
}

/**
 * Event data for terminal execution events
 */
export interface TerminalExecutionEvent {
  /** Type of event */
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'error';
  
  /** Command being executed */
  command: string;
  
  /** Context where command is executing */
  context: TerminalContext;
  
  /** Event data (content for stdout/stderr, exit code for exit, error for error) */
  data?: string | number | TerminalErrorMetadata;
  
  /** Timestamp of the event */
  timestamp: Date;
  
  /** Process ID */
  pid?: number;
}

/**
 * Interface for streaming terminal execution with real-time events
 */
export interface IStreamingTerminalExecutor extends ITerminalExecutor {
  /**
   * Execute a command with streaming output
   * 
   * @param cmd - Command to execute
   * @param opts - Execution options
   * @param onEvent - Callback for execution events
   * @returns Promise resolving to final execution result
   */
  execStream(
    cmd: string,
    opts: TerminalExecutionOptions,
    onEvent: (event: TerminalExecutionEvent) => void
  ): Promise<TerminalExecutionResult>;
}

/**
 * Configuration for terminal executor behavior
 */
export interface TerminalExecutorConfig {
  /** Default timeout for command execution (ms) */
  defaultTimeout?: number;
  
  /** Default shell for each context */
  defaultShells?: Partial<Record<TerminalContext, string>>;
  
  /** Whether to log command executions */
  enableLogging?: boolean;
  
  /** Maximum buffer size for stdout/stderr */
  maxBufferSize?: number;
  
  /** Default environment variables for each context */
  defaultEnvironment?: Partial<Record<TerminalContext, Record<string, string>>>;
}

export default ITerminalExecutor;

