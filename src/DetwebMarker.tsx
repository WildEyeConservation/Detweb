import React, { useRef, useEffect, memo, useContext, useMemo } from 'react';
import { ImageContext } from './BaseImage';
import { Marker, Tooltip } from "react-leaflet";
import { uniqueNamesGenerator, adjectives, names } from "unique-names-generator";
import * as L from "leaflet";
import * as jdenticon from "jdenticon";
import type { AnnotationType, CategoryType, ExtendedAnnotationType } from "./schemaTypes";

interface DetwebMarkerProps {
  annotation: ExtendedAnnotationType;
  categories: CategoryType[];
  activeAnnotation?: ExtendedAnnotationType;
  user: any;
  updateAnnotation: (annotation: Partial<AnnotationType>) => void;
  deleteAnnotation: (annotation: AnnotationType) => void;
  getType: (annotation: AnnotationType) => string;
}

function createIcon(
    categories: CategoryType[],
    annotation: ExtendedAnnotationType,
    activeAnnotation?: ExtendedAnnotationType
  ) {
    const color =
      categories?.find((category) => category.id === annotation.categoryId)
        ?.color ?? "red";
    let attributes = "";
    const id = annotation.objectId || annotation.proposedObjectId;
    const activeId =
      activeAnnotation?.objectId || activeAnnotation?.proposedObjectId;
    if (activeId && id === activeId) attributes += " selected";
    if (annotation.candidate) attributes += " candidate";
    if (annotation.obscured) attributes += " obscured";
    if (annotation.shadow) attributes += " shadow";
    let html = `<div class="marker" ${attributes}><div style="background-color: ${color}; border-color: ${
      annotation.objectId
        ? "#ffffff"
        : annotation.proposedObjectId
        ? "#888888"
        : "#000000"
    }">
         <span class="markerLabel">${id ? jdenticon.toSvg(id, 24) : ""}</svg></span></div></div>`;
    //let html = `<svg width="80" height="80" data-jdenticon-value="user127"/>`;
    //TODO : Confirm the units implicit in the various anchors defined below. If these are in pixels (or any other
    // absolute unit) then things may break upon a resize or even just on different resolution screens.
    // if (detection.selected)
    //   html =`<div class="spinning">${html}</div>`;
    // if (detection.candidate)
    //   html =`<div class="throbbing">${html}</div>`;
    return L.divIcon({
      className: "my-custom-pin",
      iconAnchor: [0, 0],
      labelAnchor: [0, -100],
      popupAnchor: [0, -30],
      html: html,
    });
  }

  function getContextMenuItems(
    det: AnnotationType,
    user: any,
    categories: CategoryType[],
    deleteAnnotation: (annotation: AnnotationType) => void,
    updateAnnotation: (annotation: AnnotationType) => void
  ) {
    let contextmenuItems = [];
      if (!det.shadow) {
          contextmenuItems.push({
              text: "Delete",
              index: contextmenuItems.length,
              callback: async () => {
                  deleteAnnotation(det);
              },
          });
      }
    contextmenuItems.push({
      text: det.obscured ? "Mark as visible" : "Mark as obscured",
      index: contextmenuItems.length,
      callback: async () => {
        updateAnnotation({ id:det.id, obscured: !det.obscured });
      },
    });
    if (det.objectId) {
      contextmenuItems.push({
        text: "Remove assigned name",
        index: contextmenuItems.length,
        callback: async () => {
          updateAnnotation({ ...det, objectId: null });
        },
      });
    }
    // contextmenuItems.push({text: det.note ? 'Edit Note' : 'Add Note',
    //                         index: contextmenuItems.length,
    //                       });
    // contextmenuItems.push({text: 'Link',
    //                         index: contextmenuItems.length,
    //                       });
    if (contextmenuItems.length) {
      contextmenuItems.push({
        separator: true,
        index: contextmenuItems.length,
      });
    }
    for (let category of categories) {
      if (det.categoryId !== category.id) {
        let item = {
          text: `Change to ${category.name}`,
          index: contextmenuItems.length,
          callback: async () => {
            updateAnnotation({ ...det, categoryId: category.id });
          },
        };
        contextmenuItems.push(item);
      }
    }
    if (user.isAdmin) {
      const item = {
        text: "Send message to " + det.owner,
        index: contextmenuItems.length,
        callback: async () => {
          let msg = prompt("Type the message here", "This is not an elephant");
          /* I do not know if a suitable message queue exists. But it seems that if it does allready exist, createQueue will simply return the URL for
            the existing queue. So no need to check.*/
          const { QueueUrl: url } = await createQueue({
            QueueName: `${det.owner}_${currentProject}`, // required
            Attributes: {
              MessageRetentionPeriod: "1209600", //This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
            },
          });
          det.message = msg;
          sendToQueue({ QueueUrl: url, MessageBody: JSON.stringify(det) });
          console.log(msg);
        },
      };
      contextmenuItems.push(item);
    }
    return contextmenuItems;
  }

const DetwebMarker: React.FC<DetwebMarkerProps> = memo((props) => {
    const {
        annotation,
        categories,
        activeAnnotation,
        user,
        updateAnnotation,
        deleteAnnotation,
        getType
    } = props;
    const imageContext = useContext(ImageContext!);
    const prevPropsRef = useRef<DetWebMarkerProps>();
    const prevContextRef = useRef<typeof imageContext>();

    useEffect(() => {
        // Compare current props with previous props
        if (prevPropsRef.current) {
            Object.entries(props).forEach(([key, value]) => {
                if (prevPropsRef.current[key as keyof DetWebMarkerProps] !== value) {
                    console.log(`Prop "${key}" changed:`, {
                        from: prevPropsRef.current[key as keyof DetWebMarkerProps],
                        to: value
                    });
                }
            });
        }

        // Compare current context with previous context
        if (prevContextRef.current) {
            Object.entries(imageContext).forEach(([key, value]) => {
                if (prevContextRef.current[key as keyof typeof imageContext] !== value) {
                    console.log(`ImageContext "${key}" changed:`, {
                        from: prevContextRef.current[key as keyof typeof imageContext],
                        to: value
                    });
                }
            });
        }

        // Update the refs with the current props and context
        prevPropsRef.current = props;
        prevContextRef.current = imageContext;
    }, [props, imageContext]);

    const { latLng2xy, xy2latLng } = imageContext;

    if (xy2latLng){
        console.log(`creating marker for ${annotation.id}`);
        return (
            <Marker
              key={crypto.randomUUID()}
              eventHandlers={{
                dragend: (e) => {
                  let coords = latLng2xy(e.target.getLatLng());
                  updateAnnotation({
                    ...annotation,
                    y: Math.round(coords.y),
                    x: Math.round(coords.x),
                  });
                },
              }}
              position={xy2latLng(annotation)}
              draggable={true}
              autopan={true}
              icon={createIcon(categories, annotation, activeAnnotation)}
              contextmenu={true}
              contextmenuInheritItems={false}
              contextmenuItems={getContextMenuItems(
                annotation,
                user,
                categories,
                deleteAnnotation,
                updateAnnotation,
              )}
            >
              <Tooltip>
                Category: {getType(annotation)} <br />
                Created by : {annotation?.owner}
                <br />
                {annotation?.createdAt && (
                  <>
                    Created at : {annotation?.createdAt} <br />
                  </>
                )}
                {annotation.objectId &&
                  `Name: ${uniqueNamesGenerator({ dictionaries: [adjectives, names], seed: annotation.objectId, style: "capital", separator: " " })}`}
                {!annotation.objectId &&
                  annotation.proposedObjectId &&
                  `Proposed Name: ${uniqueNamesGenerator({ dictionaries: [adjectives, names], seed: annotation.proposedObjectId, style: "capital", separator: " " })}`}
              </Tooltip>
            </Marker>
          );
    } else {
        return null;
    }
}, (prevProps, nextProps) => {
    const prevAnno = prevProps.annotation;
    const nextAnno = nextProps.annotation;
    const arePropsEqual = (
        prevAnno.id === nextAnno.id &&
        prevAnno.x === nextAnno.x &&
        prevAnno.y === nextAnno.y &&
        prevAnno.categoryId === nextAnno.categoryId &&
        prevAnno.objectId === nextAnno.objectId &&
        prevAnno.proposedObjectId === nextAnno.proposedObjectId &&
        prevAnno.shadow === nextAnno.shadow &&
        prevAnno.obscured === nextAnno.obscured &&
        prevProps.activeAnnotation?.id === nextProps.activeAnnotation?.id
    );
    return arePropsEqual;
}
);

export default DetwebMarker;
