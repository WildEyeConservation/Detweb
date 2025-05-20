import React, {ComponentType } from "react";

interface AddAckToBodyProps {
  handleMessage?: (d: { ack?: any; parsedBody: any }) => void;
  [key: string]: any;
}

export function addAckToBody<T extends AddAckToBodyProps>(WrappedComponent: ComponentType<T>,) {
  return class AddAckToBody extends React.Component<T> {
    handleMessage = (d: { ack?: any; parsedBody: any }) => {
      if (d.ack) {
        d.parsedBody.ack = d.ack;
      }
      if (this.props.handleMessage) {
        this.props.handleMessage(d);
      }
    };

    render = () => {
      return (
        <WrappedComponent {...this.props} handleMessage={this.handleMessage} />
      );
    };
  };
}
