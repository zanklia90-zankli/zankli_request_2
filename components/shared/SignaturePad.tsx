import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export interface SignaturePadRef {
    clear: () => void;
    getSignature: () => string | null;
}

const SignaturePad = forwardRef<SignaturePadRef, { label: string }>(({ label }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    }, []);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const event = (e as React.TouchEvent).touches ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        isDrawing.current = true;
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    useImperativeHandle(ref, () => ({
        clear: handleClear,
        getSignature: () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const context = canvas.getContext('2d');
                if (context) {
                    const pixelBuffer = new Uint32Array(
                        context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
                    );
                    if (!pixelBuffer.some(color => color !== 0)) {
                        return null; // Is empty
                    }
                }
                return canvas.toDataURL('image/png');
            }
            return null;
        }
    }));

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative w-full max-w-md bg-white border border-gray-300 rounded-md touch-none">
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full h-auto"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute top-1 right-1 p-1 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
                    title="Clear Signature"
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        </div>
    );
});

export default SignaturePad;
