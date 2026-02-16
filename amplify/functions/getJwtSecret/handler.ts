import type { GetJwtSecretHandler } from '../../data/resource';
import { env } from '$amplify/env/getJwtSecret';

export const handler: GetJwtSecretHandler = async (_event, context) => {
  // allow Lambda to return without waiting for open event loop handles
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    const s = env.JWT_SECRET;

    console.log('JWT_SECRET', s);

    return s;
  } catch (error) {
    console.error('Error details:', error);

    return 'error';
  }
};
