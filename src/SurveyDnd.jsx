import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import Button from 'react-bootstrap/Button';
import DndTask, { getItemStyle, getListStyle } from './DndTask';

/** 
 * This component is a wrapper around DndTask specifically for rendering surveys 
 */

const SurveyDraggable = (props) => {
  const { item, index, sets } = props

  return (
    <Draggable
      key={item.uniqueId}
      draggableId={item.uniqueId}
      index={index}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={getItemStyle(
            snapshot.isDragging,
            provided.draggableProps.style
          )}
        >
          <DndTask
            id={item.uniqueId}
            name={item.name}
            elements={sets}
            multipleCols={true}
          ></DndTask>
        </div>
      )}
    </Draggable>
  );
}

const SurveyDnd = (props) => {
  const { uniqueId, id, name, elements, sets, onDelete } = props

  return (
    <div>
      {onDelete ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly' }}>
          <h4>{name}</h4>
          <Button onClick={onDelete.bind(this, id)}>Delete</Button>
        </div>
      ) : (<h4 style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>{name}</h4>)}
      <Droppable key={name} droppableId={uniqueId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            style={getListStyle(snapshot.isDraggingOver)}
            {...provided.droppableProps}
          >
            {elements.map((item, index) => (
              <SurveyDraggable
                key={item.uniqueId}
                item={item}
                name={name}
                index={index}
                sets={sets.filter(set => set.stratum === item.id)}
              ></SurveyDraggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default SurveyDnd;