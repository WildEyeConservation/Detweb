import React from 'react';

export function addAckToBody(WrappedComponent) {
    return class AddAckToBody extends React.Component {

        handleMessage = (d) => {
            if (d.ack){
                d.parsedBody.ack=d.ack
            }
            if (this.props.handleMessage){
                this.props.handleMessage(d)
            }
        }

        render = () => {
            return <WrappedComponent {...this.props} handleMessage={this.handleMessage}/>
        };
    };
}
