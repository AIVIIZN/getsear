/**
 * Worker process entry point.
 *
 * Imports each worker so they register with BullMQ on boot. Workers
 * self-start when `START_WORKERS=1` is set in the environment.
 *
 * Sister tasks will append their workers to this file as they land.
 */

export { campaignEmailWorker, startCampaignEmailWorker, CAMPAIGN_EMAIL_QUEUE } from './campaign-email-worker'
