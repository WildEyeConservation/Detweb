import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { Search, X } from 'lucide-react';
import type { CategoryType } from './schemaTypes';

interface ChangeCategoryModalProps {
  show: boolean;
  onClose: () => void;
  categories: CategoryType[];
  currentCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
}

export default function ChangeCategoryModal({
  show,
  onClose,
  categories,
  currentCategoryId,
  onSelectCategory,
}: ChangeCategoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (show) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [show]);

  // Filter categories based on search and exclude current
  const filteredCategories = useMemo(() => {
    return categories
      .filter((cat) => cat.id !== currentCategoryId)
      .filter((cat) =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, currentCategoryId, searchTerm]);

  const currentCategory = categories.find((c) => c.id === currentCategoryId);

  const handleSelect = (categoryId: string) => {
    onSelectCategory(categoryId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // If only one result and Enter is pressed, select it
    if (e.key === 'Enter' && filteredCategories.length === 1) {
      handleSelect(filteredCategories[0].id);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered size='lg'>
      <Modal.Header
        closeButton
        style={{
          background: '#5B6977',
          borderBottom: 'none',
        }}
      >
        <Modal.Title style={{ color: '#fff', fontWeight: 600 }}>
          Change Label
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 0, background: '#4E5D6C' }}>
        {/* Current category display */}
        {currentCategory && (
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '13px' }}>Current:</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.1)',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: currentCategory.color || '#888',
                  border: '2px solid rgba(255,255,255,0.3)',
                }}
              />
              <span style={{ color: '#fff', fontWeight: 500 }}>
                {currentCategory.name}
              </span>
            </div>
          </div>
        )}

        {/* Search input */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666',
              }}
            />
            <Form.Control
              ref={searchInputRef}
              type='text'
              placeholder='Search labels...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                paddingLeft: '40px',
                paddingRight: searchTerm ? '36px' : '12px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#fff',
                height: '42px',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Categories grid */}
        <div
          style={{
            padding: '16px 20px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {filteredCategories.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#888',
                padding: '40px 20px',
              }}
            >
              {searchTerm
                ? `No labels matching "${searchTerm}"`
                : 'No other labels available'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '10px',
              }}
            >
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleSelect(category.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.borderColor =
                      category.color || '#888';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: category.color || '#888',
                      border: '2px solid rgba(255,255,255,0.3)',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {category.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category count */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '12px',
            textAlign: 'right',
          }}
        >
          {filteredCategories.length} label
          {filteredCategories.length === 1 ? '' : 's'}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      </Modal.Body>
      <Modal.Footer
        style={{
          background: '#5B6977',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Button variant='dark' onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
