/**
 * Pipeline resolver request handler
 */
export const request = () => {
    return {};
};
/**
 * Pipeline resolver response handler
 */
export const response = (ctx) => {
    return ctx.prev.result;
};
