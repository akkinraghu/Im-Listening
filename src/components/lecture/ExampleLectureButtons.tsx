import React from 'react';
import { exampleLectures } from '@/data/exampleLectures';

interface ExampleLectureButtonsProps {
  onSelectLecture: (content: string) => void;
}

const ExampleLectureButtons: React.FC<ExampleLectureButtonsProps> = ({ onSelectLecture }) => {
  return (
    <div className="flex flex-col space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Example Lectures</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {exampleLectures.map((lecture) => (
          <button
            key={lecture.id}
            onClick={() => onSelectLecture(lecture.content)}
            className="flex flex-col items-start p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow text-left group"
          >
            <div className="flex items-center w-full">
              <div className="flex-1">
                <h4 className="font-medium text-purple-700 group-hover:text-purple-800">{lecture.title}</h4>
                <p className="text-xs text-gray-500">{lecture.subject}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-1 group-hover:bg-purple-200 transition-colors">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-600 line-clamp-2">
              {lecture.content.split('\n')[0]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExampleLectureButtons;
