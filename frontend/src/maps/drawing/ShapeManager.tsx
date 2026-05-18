/**
 * Shape Manager
 * Şekil yönetimi (seçim, düzenleme, silme, hareket ettirme)
 */

import React, { useState, useCallback } from 'react';
import type { ShapeProperties, ShapeType } from './types';

export interface ShapeManagerState {
  shapes: ShapeProperties[];
  selectedShapeId: string | null;
  drawingMode: ShapeType | null;
}

export interface ShapeManagerActions {
  addShape: (shape: ShapeProperties) => void;
  removeShape: (shapeId: string) => void;
  selectShape: (shapeId: string | null) => void;
  updateShape: (shapeId: string, updates: Partial<ShapeProperties>) => void;
  clearShapes: () => void;
  setDrawingMode: (mode: ShapeType | null) => void;
}

/**
 * Shape Manager Hook
 */
export function useShapeManager(): [ShapeManagerState, ShapeManagerActions] {
  const [shapes, setShapes] = useState<ShapeProperties[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState<ShapeType | null>(null);

  const addShape = useCallback((shape: ShapeProperties) => {
    setShapes(prev => [...prev, shape]);
  }, []);

  const removeShape = useCallback((shapeId: string) => {
    setShapes(prev => prev.filter(s => s.id !== shapeId));
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null);
    }
  }, [selectedShapeId]);

  const selectShape = useCallback((shapeId: string | null) => {
    setSelectedShapeId(shapeId);
  }, []);

  const updateShape = useCallback((shapeId: string, updates: Partial<ShapeProperties>) => {
    setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, ...updates } : s));
  }, []);

  const clearShapes = useCallback(() => {
    setShapes([]);
    setSelectedShapeId(null);
  }, []);

  const state: ShapeManagerState = {
    shapes,
    selectedShapeId,
    drawingMode,
  };

  const actions: ShapeManagerActions = {
    addShape,
    removeShape,
    selectShape,
    updateShape,
    clearShapes,
    setDrawingMode,
  };

  return [state, actions];
}
