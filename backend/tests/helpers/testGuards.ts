import { describe } from 'vitest';

const dbReady = Boolean((globalThis as { __DB_READY__?: boolean }).__DB_READY__);
const canBindPort = Boolean((globalThis as { __CAN_BIND_PORT__?: boolean }).__CAN_BIND_PORT__);

export const describeIfDb = dbReady ? describe : describe.skip;
export const describeIfNet = canBindPort ? describe : describe.skip;
export const describeIfDbAndNet = dbReady && canBindPort ? describe : describe.skip;
