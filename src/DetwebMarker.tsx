import React, { memo, useContext, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';
import * as L from 'leaflet';
import * as jdenticon from 'jdenticon';
import type {
  AnnotationType,
  CategoryType,
  ExtendedAnnotationType,
} from './schemaTypes';
import { ManagementContext, GlobalContext } from './Context';
import ChangeCategoryModal from './ChangeCategoryModal';

interface LocationBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function isInsideLocation(px: number, py: number, loc: LocationBounds): boolean {
  return (
    Math.abs(px - loc.x) < loc.width / 2 &&
    Math.abs(py - loc.y) < loc.height / 2
  );
}

interface DetwebMarkerProps {
  annotation: ExtendedAnnotationType;
  categories: CategoryType[];
  activeAnnotation?: ExtendedAnnotationType;
  user: any;
  updateAnnotation: (annotation: Partial<AnnotationType>) => void;
  deleteAnnotation: (annotation: AnnotationType) => void;
  getType: (annotation: AnnotationType) => string;
  latLng2xy: (
    input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>
  ) => L.Point | L.Point[];
  xy2latLng: (
    input: L.Point | [number, number] | Array<L.Point | [number, number]>
  ) => L.LatLng | L.LatLng[];
  onShadowDrag?: (id: string, x: number, y: number) => void;
  hideIdenticon?: boolean;
  onClick?: (annotation: ExtendedAnnotationType) => void;
  locationBounds?: LocationBounds;
}

function createIcon(
  categories: CategoryType[],
  annotation: ExtendedAnnotationType,
  activeAnnotation?: ExtendedAnnotationType,
  hideIdenticon?: boolean
) {
  const color =
    categories?.find((category) => category.id === annotation.categoryId)
      ?.color ?? 'red';
  let attributes = '';
  const id = annotation.objectId || annotation.proposedObjectId;
  const activeId =
    activeAnnotation?.objectId || activeAnnotation?.proposedObjectId;
  if (activeId && id === activeId) attributes += ' selected';
  if (annotation.candidate) attributes += ' candidate';
  if (annotation.obscured) attributes += ' obscured';
  if (annotation.shadow) attributes += ' shadow';
  const borderColor =
    annotation.objectId === annotation.id
      ? '#ffffff'
      : annotation.objectId
      ? '#888888'
      : '#000000';
  const isFalseNegative = String(
    (annotation as { source?: string }).source || ''
  )
    .toLowerCase()
    .includes('false-negative');
  // Only show identicon if annotation is primary (id === objectId) - purely based on objectId value
  const isPrimary = annotation.id === annotation.objectId;
  const markerLabel = isFalseNegative
    ? '<span style="font-weight:bold;font-size:18px;line-height:1;">!</span>'
    : !hideIdenticon && isPrimary && annotation.objectId
    ? jdenticon.toSvg(annotation.objectId, 20)
    : '';

  let html = `
      <div class="marker" ${attributes}>
        <div style="background-color: ${color}; border-color: ${borderColor}, position: relative; overflow: hidden;">
          <span class="markerLabel" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            ${markerLabel}
          </span>
        </div>
      </div>
    `;
  //let html = `<svg width="80" height="80" data-jdenticon-value="user127"/>`;
  //TODO : Confirm the units implicit in the various anchors defined below. If these are in pixels (or any other
  // absolute unit) then things may break upon a resize or even just on different resolution screens.
  // if (detection.selected)
  //   html =`<div class="spinning">${html}</div>`;
  // if (detection.candidate)
  //   html =`<div class="throbbing">${html}</div>`;
  return L.divIcon({
    className: 'my-custom-pin',
    iconAnchor: [0, 0],
    popupAnchor: [0, -30],
    html: html,
  });
}


const DetwebMarker: React.FC<DetwebMarkerProps> = memo(
  (props) => {
    const {
      annotation,
      categories,
      activeAnnotation,
      updateAnnotation,
      deleteAnnotation,
      getType,
      latLng2xy,
      xy2latLng,
      onShadowDrag,
      onClick,
      locationBounds,
    } = props;
    const { allUsers } = useContext(ManagementContext)!;
    const { client } = useContext(GlobalContext)!;
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    // If locationBounds is set, annotations outside the bounds are read-only
    const isOutsideBounds = locationBounds
      ? !isInsideLocation(annotation.x, annotation.y, locationBounds)
      : false;

    function getContextMenuItems() {
      let contextmenuItems = [];
      // If annotation is outside location bounds, show no editable actions
      if (isOutsideBounds) {
        contextmenuItems.push({
          text: 'Outside location (read-only)',
          index: 0,
          disabled: true,
        });
        return contextmenuItems;
      }
      if (!annotation.shadow) {
        contextmenuItems.push({
          text: 'Delete',
          index: contextmenuItems.length,
          callback: async () => {
            deleteAnnotation(annotation);
          },
        });
      }
      contextmenuItems.push({
        text: annotation.obscured ? 'Mark as visible' : 'Mark as obscured',
        index: contextmenuItems.length,
        callback: async () => {
          updateAnnotation({ ...annotation, obscured: !annotation.obscured });
        },
      });
      if (annotation.objectId) {
        contextmenuItems.push({
          text: 'Remove assigned name',
          index: contextmenuItems.length,
          callback: async () => {
            updateAnnotation({ ...annotation, objectId: undefined });
          },
        });
        if (
          activeAnnotation &&
          activeAnnotation.objectId !== annotation.objectId
        ) {
          const oldName = uniqueNamesGenerator({
            dictionaries: [adjectives, names],
            seed: annotation.objectId,
            style: 'capital',
            separator: ' ',
          });
          const newName = uniqueNamesGenerator({
            dictionaries: [adjectives, names],
            seed: activeAnnotation.objectId ?? '',
            style: 'capital',
            separator: ' ',
          });
          contextmenuItems.push({
            text: `Rename "${oldName}" to "${newName}"`,
            index: contextmenuItems.length,
            callback: async () => {
              if (annotation.objectId) {
                const oldObjectId = annotation.objectId;
                const newObjectId = activeAnnotation.objectId;

                // Collect all annotations with the old objectId (handling pagination)
                const allAnnotations: any[] = [];
                let nextToken: string | null = null;

                do {
                  const result =
                    await client.models.Annotation.annotationsByObjectId(
                      {
                        objectId: oldObjectId,
                      },
                      { nextToken: nextToken || undefined }
                    );

                  allAnnotations.push(...result.data);
                  nextToken = result.nextToken || null;
                } while (nextToken);

                console.log(
                  `Found ${allAnnotations.length} annotations with name "${oldName}". Renaming to "${newName}".`
                );

                // Update all annotations in parallel, awaiting completion
                await Promise.all(
                  allAnnotations.map((a) =>
                    client.models.Annotation.update({
                      id: a.id,
                      objectId: newObjectId,
                    })
                  )
                );

                console.log(
                  `Successfully renamed ${allAnnotations.length} annotations.`
                );
              }
            },
          });
        }
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
      // Single "Change Label" option that opens the category selection modal
      contextmenuItems.push({
        text: 'Change Label',
        index: contextmenuItems.length,
        callback: () => {
          setShowCategoryModal(true);
        },
      });
      // TODO: re-implement admin messaging when SQS APIs are available
      return contextmenuItems;
    }

    // const prevPropsRef = useRef<DetWebMarkerProps>();
    // const prevContextRef = useRef<typeof imageContext>();

    // useEffect(() => {
    //     // Compare current props with previous props
    //     if (prevPropsRef.current) {
    //         Object.entries(props).forEach(([key, value]) => {
    //             if (prevPropsRef.current[key as keyof DetWebMarkerProps] !== value) {
    //                 console.log(`Prop "${key}" changed:`, {
    //                     from: prevPropsRef.current[key as keyof DetWebMarkerProps],
    //                     to: value
    //                 });
    //             }
    //         });
    //     }

    //     // Compare current context with previous context
    //     if (prevContextRef.current) {
    //         Object.entries(imageContext).forEach(([key, value]) => {
    //             if (prevContextRef.current[key as keyof typeof imageContext] !== value) {
    //                 console.log(`ImageContext "${key}" changed:`, {
    //                     from: prevContextRef.current[key as keyof typeof imageContext],
    //                     to: value
    //                 });
    //             }
    //         });
    //     }

    //     // Update the refs with the current props and context
    //     prevPropsRef.current = props;
    //     prevContextRef.current = imageContext;
    // }, [props, imageContext]);

    const handleCategoryChange = (categoryId: string) => {
      updateAnnotation({ id: annotation.id, categoryId });
    };

    if (xy2latLng) {
      console.log(`creating marker for ${annotation.id}`);
      // Cast to any to allow leaflet-contextmenu props (contextmenu, contextmenuItems, etc.)
      const MarkerWithContextMenu = Marker as any;
      return (
        <>
          <MarkerWithContextMenu
            key={crypto.randomUUID()}
            eventHandlers={{
              dragend: (e: any) => {
                const coords = latLng2xy(e.target.getLatLng()) as L.Point;
                const x = Math.round(coords.x);
                const y = Math.round(coords.y);
                // Revert if dragged outside location bounds
                if (locationBounds && !isInsideLocation(x, y, locationBounds)) {
                  const originalPos = xy2latLng(L.point(annotation.x, annotation.y)) as L.LatLng;
                  e.target.setLatLng(originalPos);
                  return;
                }
                if (annotation.shadow && onShadowDrag) {
                  onShadowDrag(annotation.id, x, y);
                } else {
                  updateAnnotation({ ...annotation, x, y });
                }
              },
              click: () => {
                if (onClick) {
                  onClick(annotation);
                }
              },
              mouseover: (e: any) => {
                //If the user hovers over the marker, move the input focus here.
                e.target.getElement().focus();
              },
              mouseout: (e: any) => {
                //If the user moves the mouse away from the marker, blur the input field.
                e.target.getElement().blur();
              },
              keydown: (e: any) => {
                //if the user presses the backspace key, delete the annotation
                if (e.originalEvent.key === 'Backspace' && !isOutsideBounds) {
                  deleteAnnotation(annotation);
                }
              },
            }}
            position={xy2latLng(L.point(annotation.x, annotation.y)) as L.LatLng}
            draggable={!isOutsideBounds}
            autopan={true}
            icon={createIcon(
              categories,
              annotation,
              activeAnnotation,
              props.hideIdenticon
            )}
            contextmenu={true}
            contextmenuInheritItems={false}
            contextmenuItems={getContextMenuItems()}
          >
            <Tooltip>
              Label: {getType(annotation)} <br />
              {String((annotation as { source?: string }).source || '')
                .toLowerCase()
                .includes('false-negative') && (
                <>
                  False Negative <br />
                </>
              )}
              Created by :{' '}
              {allUsers.find((u) => u.id == annotation.owner)?.name ||
                'Unknown'}
              <br />
              {annotation?.createdAt && (
                <>
                  Created at : {annotation?.createdAt} <br />
                </>
              )}
              {annotation.objectId &&
                `Name: ${uniqueNamesGenerator({
                  dictionaries: [adjectives, names],
                  seed: annotation.objectId,
                  style: 'capital',
                  separator: ' ',
                })}`}
              {!annotation.objectId &&
                annotation.proposedObjectId &&
                `Proposed Name: ${uniqueNamesGenerator({
                  dictionaries: [adjectives, names],
                  seed: annotation.proposedObjectId,
                  style: 'capital',
                  separator: ' ',
                })}`}
            </Tooltip>
          </MarkerWithContextMenu>
          <ChangeCategoryModal
            show={showCategoryModal}
            onClose={() => setShowCategoryModal(false)}
            categories={categories}
            currentCategoryId={annotation.categoryId}
            onSelectCategory={handleCategoryChange}
          />
        </>
      );
    } else {
      return null;
    }
  },
  (prevProps, nextProps) => {
    const prevAnno = prevProps.annotation;
    const nextAnno = nextProps.annotation;
    const arePropsEqual =
      prevAnno.id === nextAnno.id &&
      prevAnno.x === nextAnno.x &&
      prevAnno.y === nextAnno.y &&
      prevAnno.categoryId === nextAnno.categoryId &&
      prevAnno.objectId === nextAnno.objectId &&
      prevAnno.proposedObjectId === nextAnno.proposedObjectId &&
      prevAnno.shadow === nextAnno.shadow &&
      prevAnno.obscured === nextAnno.obscured &&
      prevAnno.createdAt === nextAnno.createdAt &&
      prevAnno.owner === nextAnno.owner &&
      prevProps.activeAnnotation?.id === nextProps.activeAnnotation?.id &&
      prevProps.locationBounds === nextProps.locationBounds;
    return arePropsEqual;
  }
);

export default DetwebMarker;
