import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SubtopicSelection = {
  categoria: string;
  subtema: string;
};

interface SessionState {
  selectedSubcategories: SubtopicSelection[];
}

const initialState: SessionState = {
  selectedSubcategories: [],
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    toggleSubtopic: (state, action: PayloadAction<{ category: string; subtopic: string }>) => {
      const index = state.selectedSubcategories.findIndex(
        s => s.categoria === action.payload.category && 
             s.subtema === action.payload.subtopic
      );
      
      if (index >= 0) {
        state.selectedSubcategories.splice(index, 1);
      } else {
        state.selectedSubcategories.push({
          categoria: action.payload.category,
          subtema: action.payload.subtopic
        });
      }
    },
    toggleAllSubtopics: (state, action: PayloadAction<{ category: string; subtopics: string[] }>) => {
      const existing = state.selectedSubcategories.filter(
        s => s.categoria === action.payload.category
      );
      
      if (existing.length === action.payload.subtopics.length) {
        // Remove all from category
        state.selectedSubcategories = state.selectedSubcategories.filter(
          s => s.categoria !== action.payload.category
        );
      } else {
        // Add missing subtopics
        action.payload.subtopics.forEach(subtopic => {
          if (!existing.some(s => s.subtema === subtopic)) {
            state.selectedSubcategories.push({
              categoria: action.payload.category,
              subtema: subtopic
            });
          }
        });
      }
    }
  }
});

export const { toggleSubtopic, toggleAllSubtopics } = sessionSlice.actions;
export default sessionSlice.reducer;