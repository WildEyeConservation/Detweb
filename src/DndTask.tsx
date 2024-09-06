import React from "react";
import { Draggable, Droppable, DraggableProvided, DroppableProvided, DraggableStateSnapshot, DroppableStateSnapshot } from "react-beautiful-dnd";

interface DndTaskProps {
  id: string;
  name: string;
  elements: any[];
  multipleCols: boolean;
}

export const getItemStyle = (isDragging: boolean, draggableStyle: any) => ({
  // styles we need to apply on draggables
  userSelect: "none",
  padding: 16,
  margin: `0 0 8px 0`,
  background: isDragging ? "lightgreen" : "grey",
  ...draggableStyle,
});

export const getListStyle = (isDraggingOver: boolean) => ({
  background: isDraggingOver ? "lightblue" : "lightgrey",
  padding: 8,
  width: 250,
});

const DndTask: React.FC<DndTaskProps> = ({ id, name, elements, multipleCols }) => (
  <Droppable droppableId={id} direction={multipleCols ? "horizontal" : "vertical"}>
    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
      <div
        ref={provided.innerRef}
        style={getListStyle(snapshot.isDraggingOver)}
        {...provided.droppableProps}
      >
        <h5>{name}</h5>
        {elements.map((element, index) => (
          <Draggable key={element.id} draggableId={element.id} index={index}>
            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                style={getItemStyle(snapshot.isDragging, provided.draggableProps.style)}
              >
                {element.content}
              </div>
            )}
          </Draggable>
        ))}
        {provided.placeholder}
      </div>
    )}
  </Droppable>
);

export default DndTask;