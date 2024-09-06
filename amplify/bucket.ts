import { envNameContext } from "../cdk/cdk.context";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { RemovalPolicy } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";

type CreateBucketProps = {
  allowedOrigins: string[];
  actions: string[];
  roles: cdk.aws_iam.IRole[];
  name: string;
};
/* This construct just creates a bog-standard S3 bucket but with CORS set up to allow access to our frontend, as specified in the context file*/
export function createBucket(scope: Construct, props: CreateBucketProps) {
  const inputsBucket = new s3.Bucket(
    scope,props.name,
    {
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: props.allowedOrigins,
          allowedHeaders: ["*"],
          exposedHeaders: [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
            "ETag",
          ],
        },
      ],
    },
  );

  // Let signed in users CRUD on a bucket
  const canReadUpdateDeleteFromPublicDirectory = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: props.actions,
    resources: [`*`], //[`${inputsBucket.bucketArn}/public/*`],
  });

  const managedPolicy = new iam.ManagedPolicy(
    scope,
    `SignedInUserManagedPolicy_${props.name}`,
    {
      description: "Allow access to s3 bucket by signed in users.",
      statements: [canReadUpdateDeleteFromPublicDirectory],
      roles: props.roles,
    },
  );
  return inputsBucket;
}
