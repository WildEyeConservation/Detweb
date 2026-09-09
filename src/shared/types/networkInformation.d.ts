interface BrowserNetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface Navigator {
  readonly connection?: BrowserNetworkInformation;
  readonly mozConnection?: BrowserNetworkInformation;
  readonly webkitConnection?: BrowserNetworkInformation;
}
