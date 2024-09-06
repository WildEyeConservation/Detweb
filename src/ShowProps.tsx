//This is just a debugging component that just displays its own props as text It
//also has two buttons which are bound to the onPrev and onNext callbacks respectively
import React from "react";

interface ShowPropsProps {
  reload?: () => void;
  onNext?: () => void;
  [key: string]: any;
}

export class ShowProps extends React.Component<ShowPropsProps> {
  random: number;

  constructor(props: ShowPropsProps) {
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
