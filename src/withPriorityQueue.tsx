import { useState } from "react";
import React from "react";
import useSQS from "./useSQS";
//import { useTesting } from "./useTesting";
import { Modal, Row, Col, Button } from "react-bootstrap";
import BaseImage from "./BaseImage";
import Location from "./Location";

interface WithPreloadingProps {
  historyN?: number;
  preloadN?: number;
  [key: string]: any;
}

export function withPreloading2(WrappedComponent: React.ComponentType<any>) {
  let WithPreloading = function ({ historyN = 2, preloadN= 3, ...rest }: WithPreloadingProps) {
    // let [index,setIndex]=useState(0)
    // let _index=0
    // let el=undefined

    // useEffect(() => {
    //   if (currentId===undefined){
    //     setIndex(0)
    //     if (props.buffer.length){
    //       setCurrentId(props.buffer[0].id)
    //     }
    //   }else{
    //     _index=props.buffer.findIndex(entry=>entry.id==currentId)
    //     if (_index<0){
    //       setIndex(0)
    //       setCurrentId(buffer[0].id)
    //     }else{
    //       setIndex(_index)
    //     }
    //     el=document?.getElementById(props.buffer[_index]?.location_id)
    //     console.log(el)
    //     el?.focus();
    //   }
    // });
    const { buffer, index, next, prev, inject } = useSQS();
    const [errorprops, setErrorprops] = useState<any>(false);
    //useTesting(inject, setErrorprops);
    //useSQS(3)
    const subsetStart = Math.max(index - historyN, 0); // Keep at the least the last historyN entries in memory
    const subset = buffer.slice(subsetStart, index + preloadN);

    // buffer.forEach((msg,i)=>{console.log(`Buffer [${i}].id=${msg.id}`)})
    if (subset?.length) {
      return (
        <>
          {subset.map((entry, i) => (
            <div
              key={entry.message_id}
              style={{
                visibility: i === index - subsetStart ? "visible" : "hidden",
                position: "absolute",
                justifyContent: "center",
                display: i === index - subsetStart ? "contents" : "flex",
                width: "80%",
              }}
            >
              {/*  */}
              <WrappedComponent
                {...entry}
                visible={i === index - subsetStart}
                next={next}
                prev={prev}
                {...rest}
              />
              <div></div>
            </div>
          ))}

          <Modal
            size="xl"
            centered
            show={errorprops}
            backdrop="static"
            onHide={() => setErrorprops(false)}
          >
            <Modal.Header closeButton>
              <Modal.Title>
                Looks like you missed some animals. Perhaps it is time to take a
                break?
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Row>
                <Col />
                <Col xs={10} className="align-middle justify-content-center">
                  {errorprops && (
                    <BaseImage
                      {...errorprops}
                      containerwidth="100%"
                      containerheight="800px"
                    >
                      <Location {...errorprops} />
                    </BaseImage>
                  )}
                </Col>
                <Col />
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="primary"
                onClick={() => {
                  setErrorprops(false);
                }}
              >
                OK
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      );
    } else {
      return <></>;
    }
  };
  //WithPreloading.defaultProps = { historyN: 2, preloadN: 3 };
  return WithPreloading;
}
