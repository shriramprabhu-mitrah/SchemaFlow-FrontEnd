export interface Environment {
  production: boolean;
  name: string;
  googleAnalyticsMeasurementId?: string;
  googleAnalyticsMeasurementProtocolSecret?: string;
  razorpayKeyId?: string;
}
