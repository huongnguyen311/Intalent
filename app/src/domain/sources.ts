import { CHANNEL_SOURCE } from './campaigns';

/** Every `source` label the app writes, so seed data and live flows agree. */
export const SOURCE_CAREERS = 'Careers page';
export const SOURCE_CV_UPLOAD = 'CV Upload';
export const SOURCE_ULTRA_UPLOAD = 'Ultra Upload';
export const SOURCE_TALENT_POOL = 'Talent Pool';
export const SOURCE_MANUAL = 'Manual';
export const SOURCE_REFERRAL = CHANNEL_SOURCE.referral;

/** Activity `by` for applications that arrive without a signed-in user (self-service, not a TA upload). */
export const CAREERS_ACTOR = 'Careers site';

/** Campaign channel names (Facebook, LinkedIn, ...) are the other sources an Application can carry. */
export { CHANNEL_SOURCE };
