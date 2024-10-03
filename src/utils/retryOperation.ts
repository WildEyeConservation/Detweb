type RetryOptions = {
    maxRetries: number;
    delay: number;
    backoffFactor: number;
    retryableErrors?: string[];
  };
  
  const defaultOptions: RetryOptions = {
    maxRetries: 3,
    delay: 1000,
    backoffFactor: 2,
  };
  
  export async function retryOperation<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const { maxRetries, delay, backoffFactor, retryableErrors } = { ...defaultOptions, ...options };
  
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (retryableErrors && !retryableErrors.some(errMsg => lastError!.message.includes(errMsg))) {
          throw lastError;
        }
  
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
  
        console.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoffFactor, attempt)));
      }
    }
    throw lastError;
  }