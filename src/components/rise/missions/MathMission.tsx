import { useState, useEffect, useRef } from 'react';
import { Calculator, Delete, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MathMissionProps {
  onComplete: () => void;
  requiredSolves?: number;
  /** Per-problem time limit. Default 60s. Timeout = auto-skip (no credit). */
  perProblemSeconds?: number;
}

export function MathMission({
  onComplete,
  requiredSolves = 3,
  perProblemSeconds = 60,
}: MathMissionProps) {
  const [problem, setProblem] = useState({ question: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [solvedCount, setSolvedCount] = useState(0);
  const [isError, setIsError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(perProblemSeconds);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateMathProblem = () => {
    const num1 = Math.floor(Math.random() * 90) + 10;
    const num2 = Math.floor(Math.random() * 90) + 10;
    const op = Math.random() < 0.5 ? '+' : '-';
    let answer = 0;
    let question = '';
    if (op === '+') {
      answer = num1 + num2;
      question = `${num1} + ${num2}`;
    } else {
      const max = Math.max(num1, num2);
      const min = Math.min(num1, num2);
      answer = max - min;
      question = `${max} - ${min}`;
    }
    setProblem({ question, answer });
    setUserInput('');
    setTimeLeft(perProblemSeconds);
  };

  useEffect(() => {
    generateMathProblem();
  }, []);

  // ⏱ 60s per-problem countdown. Timeout = shake + auto-skip to next problem.
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setIsError(true);
          toast.error('Time up! Next problem…', { duration: 1200 });
          setTimeout(() => {
            setIsError(false);
            generateMathProblem();
          }, 400);
          return perProblemSeconds;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [problem.question, perProblemSeconds]);

  useEffect(() => {
    if (userInput.length > 0 && parseInt(userInput) === problem.answer) {
      const newSolvedCount = solvedCount + 1;
      setSolvedCount(newSolvedCount);
      toast.success(`Correct! ${newSolvedCount}/${requiredSolves} solved`);
      if (newSolvedCount >= requiredSolves) {
        setTimeout(() => onComplete(), 500);
      } else {
        generateMathProblem();
      }
    } else if (
      userInput.length >= problem.answer.toString().length &&
      parseInt(userInput) !== problem.answer
    ) {
      setIsError(true);
      setTimeout(() => {
        setIsError(false);
        setUserInput('');
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInput]);

  const handleNumberPress = (num: string) => {
    if (userInput.length < 5) setUserInput((prev) => prev + num);
  };
  const handleDelete = () => setUserInput((prev) => prev.slice(0, -1));

  const timerPct = (timeLeft / perProblemSeconds) * 100;
  const timerLow = timeLeft <= 10;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-2xl">
            <Calculator className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold">Math Mission</h2>
        </div>
        <div className="text-sm font-medium text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
          {solvedCount} / {requiredSolves}
        </div>
      </div>

      {/* ⏱ Per-problem timer */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${timerLow ? 'text-rose-400' : 'text-white/60'}`}>
            <Timer className="h-3.5 w-3.5" />
            Time per problem
          </div>
          <span className={`text-sm font-bold tabular-nums ${timerLow ? 'text-rose-400 animate-pulse' : 'text-white/80'}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${timerLow ? 'bg-rose-500' : 'bg-indigo-400'}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Problem + input */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 mb-8">
        <div className="text-5xl font-black tracking-wider text-white/90">
          {problem.question} = ?
        </div>
        <div
          className={`h-20 w-full max-w-xs flex items-center justify-center text-4xl font-bold rounded-2xl border-2 transition-all ${
            isError
              ? 'border-rose-500 text-rose-500 bg-rose-500/10 translate-x-1'
              : userInput
                ? 'border-indigo-500 text-white bg-indigo-500/10'
                : 'border-white/10 text-white/20 bg-white/5'
          }`}
        >
          {userInput || 'Tap numbers'}
        </div>
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto w-full pb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <Button
            key={num}
            variant="outline"
            className="h-16 text-2xl font-semibold bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl"
            onClick={() => handleNumberPress(num.toString())}
          >
            {num}
          </Button>
        ))}
        <div className="col-start-2">
          <Button
            variant="outline"
            className="h-16 w-full text-2xl font-semibold bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl"
            onClick={() => handleNumberPress('0')}
          >
            0
          </Button>
        </div>
        <Button
          variant="outline"
          className="h-16 bg-white/5 border-white/10 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 text-white/60 rounded-2xl"
          onClick={handleDelete}
        >
          <Delete className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
