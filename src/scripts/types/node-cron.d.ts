declare module 'node-cron' {
  /**
   * Schedules a task to be executed according to the cron pattern.
   * @param cronExpression The cron pattern to use for scheduling.
   * @param task The task to be executed.
   * @param options Optional configuration for the scheduled task.
   * @returns A ScheduledTask instance.
   */
  export function schedule(
    cronExpression: string,
    task: () => void,
    options?: {
      scheduled?: boolean;
      timezone?: string;
    }
  ): ScheduledTask;

  /**
   * Validates a cron expression.
   * @param cronExpression The cron pattern to validate.
   * @returns true if the expression is valid, false otherwise.
   */
  export function validate(cronExpression: string): boolean;

  /**
   * Represents a scheduled task.
   */
  export interface ScheduledTask {
    /**
     * Starts the scheduled task.
     */
    start: () => void;
    /**
     * Stops the scheduled task.
     */
    stop: () => void;
  }
}
