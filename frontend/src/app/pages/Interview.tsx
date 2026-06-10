import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { atsAPI } from '../services/api';
import { useSpeechToText } from '../../hooks/useSpeechToText'; // New hook

interface InterviewQuestion {
  type: string;
  question: string;
}

interface EvaluationResult {
  score: number;
  feedback: string;
  missingConcepts: string[];
  improvement: string;
}

interface PastAnswer {
  question: string;
  answer: string;
  evaluation: EvaluationResult;
}

export default function Interview() {
  const { resumeId, jdId } = useParams();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [context, setContext] = useState<any>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [answers, setAnswers] = useState<PastAnswer[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const { isListening, transcript, setTranscript, start, stop, clearTranscript } = useSpeechToText();

  useEffect(() => {
    async function loadQuestions() {
      console.log('[Interview] resumeId:', resumeId, '| jdId:', jdId);

      if (!resumeId || !jdId) {
        setErrorMsg('Missing resume or JD ID in URL. Please navigate from the ATS Score page.');
        setLoading(false);
        return;
      }
      try {
        const res = await atsAPI.generateInterview(resumeId, jdId);
        console.log('[Interview] API response:', res);

        if (res.success && res.data?.questions?.length > 0) {
          setQuestions(res.data.questions);
          setContext(res.data.context || {});
        } else {
          console.warn('[Interview] No questions returned from API', res);
          setErrorMsg('No questions returned. Please try again.');
        }
      } catch (err: any) {
        console.error('[Interview] loadQuestions error:', err);
        setErrorMsg(err?.message || 'Failed to connect to interview service.');
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [resumeId, jdId]);

  const handleSubmit = async () => {
    if (!transcript.trim()) return;
    setEvaluating(true);
    setErrorMsg('');
    
    try {
      const currentQ = questions[currentIndex];
      const res = await atsAPI.evaluateAnswer(currentQ.question, transcript, context);
      
      if (res.success) {
        setEvaluation(res.data);
      } else {
        throw new Error('Evaluation error');
      }
    } catch(err) {
      setErrorMsg('Failed to evaluate properly.');
    } finally {
      if (isListening) stop();
      setEvaluating(false);
    }
  };

  const handleNext = () => {
    if (evaluation) {
      setAnswers(prev => [...prev, {
        question: questions[currentIndex].question,
        answer: transcript,
        evaluation: evaluation
      }]);
    }
    
    setEvaluation(null);
    clearTranscript();
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Completed interview
      // Keep state so user can view all past answers if we iterate the UI
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 font-medium animate-pulse">Generating your personalized mock interview...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center p-8 bg-red-50 rounded-xl shadow-md max-w-md mx-4 border border-red-200">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-700 font-semibold text-lg mb-2">Could not load interview</p>
          <p className="text-red-500 text-sm mb-6">{errorMsg || 'No questions were returned from the server.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = currentIndex >= questions.length - 1 && evaluation !== null;
  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
         <h1 className="text-2xl font-bold text-gray-800">AI Mock Interview Session</h1>
         <span className="text-sm font-semibold bg-gray-200 px-3 py-1 rounded-full text-gray-600">
           Question {currentIndex + 1} of {questions.length}
         </span>
      </div>

      {isCompleted ? (
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm p-8 text-center ring-1 ring-gray-100 border-t-4 border-primary">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Interview Complete! 🎉</h2>
          <p className="text-gray-600 mb-8 max-w-lg mx-auto">Great job completing your AI evaluation. Review your historical feedbacks below or return to the dashboard.</p>
          <button onClick={() => navigate(-1)} className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm">Return to ATS Dashboard</button>
        </div>
      ) : (
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm p-8 ring-1 ring-gray-100 flex flex-col">
          <div className="mb-6 border-l-4 border-primary pl-4">
            <span className="text-xs uppercase tracking-wider font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2 inline-block">
              {currentQ.type.toUpperCase()} FOCUS
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mt-2">{currentQ.question}</h2>
          </div>

          {!evaluation ? (
            <div className="flex flex-col gap-4">
              <div className="relative group">
                <textarea 
                  className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none shadow-inner"
                  placeholder="Type your answer here or speak using the microphone..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={evaluating}
                />
                
                {isListening && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-100 px-3 py-1.5 rounded-full ring-1 ring-red-200 shadow-sm animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                    <span className="text-xs font-semibold text-red-700">Listening...</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-2 border-t pt-4">
                <button 
                  onClick={isListening ? stop : start}
                  disabled={evaluating}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm ${isListening ? 'bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
                >
                  <span className="text-lg">{isListening ? '⏹' : '🎤'}</span> 
                  {isListening ? 'Stop Recording' : 'Start Voice'}
                </button>

                <button 
                  onClick={handleSubmit}
                  disabled={!transcript.trim() || evaluating}
                  className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-md shadow-primary/20"
                >
                  {evaluating ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                      Evaluating...
                    </>
                  ) : 'Submit Answer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-fadeIn">
              <div className="border border-gray-100 rounded-lg overflow-hidden bg-gray-50">
                 <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">AI Evaluation</p>
                        <h3 className="text-lg font-bold text-gray-800">Score: <span className={`${evaluation.score > 7 ? 'text-green-600' : evaluation.score > 4 ? 'text-yellow-600' : 'text-red-600'}`}>{evaluation.score}/10</span></h3>
                    </div>
                 </div>
                 
                 <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <h4 className="text-sm font-bold tracking-wider text-gray-700 mb-2 uppercase">Feedback</h4>
                     <p className="text-gray-700 leading-relaxed bg-white p-3 rounded shadow-sm border border-gray-100">{evaluation.feedback}</p>
                   </div>
                   
                   <div>
                     <h4 className="text-sm font-bold tracking-wider text-gray-700 mb-2 uppercase">How to Improve</h4>
                     <p className="text-gray-700 leading-relaxed bg-white p-3 rounded shadow-sm border border-gray-100">{evaluation.improvement}</p>
                   </div>
                 </div>

                 {evaluation.missingConcepts && evaluation.missingConcepts.length > 0 && (
                   <div className="p-6 pt-0">
                     <h4 className="text-sm font-bold tracking-wider text-gray-700 mb-3 uppercase">Missing Concepts</h4>
                     <div className="flex flex-wrap gap-2">
                       {evaluation.missingConcepts.map((c, i) => (
                         <span key={i} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-100">
                           {c}
                         </span>
                       ))}
                     </div>
                   </div>
                 )}
              </div>

              <div className="flex justify-end mt-2">
                <button 
                  onClick={handleNext}
                  className="px-8 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors shadow-lg"
                >
                  {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Interview'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
