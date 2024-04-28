//This is just a debugging component that just displays its own props as text It
//also has two buttons which are bound to the onPrev and onNext callbacks respectively
import React from "react";

export class ShowProps extends React.Component {
  random = 0;
  constructor(props) {
    super(props);
    this.random = Math.random();
  }

  render() {
    return (
      <>
        <button onClick={this.props.reload} {...this.props}>
          PREV
        </button>
        {JSON.stringify(this.props)}
        {this.random}
        <button onClick={this.props.onNext} {...this.props}>
          NEXT
        </button>
      </>
    );
  }
}
