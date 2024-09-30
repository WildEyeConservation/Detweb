declare module 'react-organizational-chart' {
    import * as React from 'react';

    export interface TreeProps {
        lineWidth?: string;
        lineColor?: string;
        lineBorderRadius?: string;
        label: React.ReactNode;
        children?: React.ReactNode;
    }

    export interface TreeNodeProps {
        label: React.ReactNode;
        children?: React.ReactNode;
    }

    export class Tree extends React.Component<TreeProps> {}
    export class TreeNode extends React.Component<TreeNodeProps> {}
}
