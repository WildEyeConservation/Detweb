#!/usr/bin/env node
import { initStack } from './init-stack'
import 'source-map-support/register'
import { Cdk2Stack } from '../lib/cdk2-stack'

const { app, stackNameWithEnv, stackProps, context } = initStack()

const detwebStack = new Cdk2Stack(
    app,
    stackNameWithEnv,
    stackProps,
    context
)