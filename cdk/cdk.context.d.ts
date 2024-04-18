export type CDKContext = {
    appName: string
    appDescription: string
    region: string
    environment: envNameContext
    branchName: branchNameContext
    s3AllowedOrigins: [string]
}

export type envNameContext = 'develop'

export type branchNameContext = 'develop'