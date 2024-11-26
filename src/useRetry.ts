interface RetryConfig {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export function useRetry(defaultConfig: RetryConfig = {}) {
    const executeWithRetry = async <T>(
        operation: () => Promise<T>,
        config: RetryConfig = {}
    ): Promise<T> => {
        const {
            maxRetries = 5,
            baseDelay = 1000,
            maxDelay = 30000
        } = { ...defaultConfig, ...config };

        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                const result = await operation();
                
                // Handle GraphQL-style responses that might contain errors
                if (result && (result as any).errors) {
                    throw new Error('Operation returned errors');
                }
                
                return result;
            } catch (error) {
                retryCount++;
                if (retryCount === maxRetries) {
                    console.error(`Operation failed after ${maxRetries} attempts:`, error);
                    throw error;
                }
                
                const delay = Math.min(
                    baseDelay * Math.pow(2, retryCount) + Math.random() * 1000,
                    maxDelay
                );
                console.warn(`Retry ${retryCount}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('Unexpected end of retry loop');
    };

    return { executeWithRetry };
}