import { createHandler } from '../_lib/handler';
import { sendJson, setCacheHeaders } from '../_lib/response';
import { getProfile } from '../_lib/domain/profile/repo';

export default createHandler({
  auth: 'required',
  GET: async ({ req, res, userId }) => {
    const profile = await getProfile(userId);
    
    setCacheHeaders(res, { noStore: true });
    
    sendJson(res, {
      tradingWallet: profile?.tradingWallet
    });
  }
});

