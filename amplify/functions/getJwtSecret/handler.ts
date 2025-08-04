import { env } from '$amplify/env/getJwtSecret';

export const handler = async (event: any, context: any) => {
  // allow Lambda to return without waiting for open event loop handles
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    const s = env.JWT_SECRET;

    console.log('JWT_SECRET', s);

    return s;
  } catch (error: any) {
    console.error('Error details:', error);

    return 'error';
  }
};
