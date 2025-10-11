export default function Loader({ text = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-600 animate-pulse">
      <div className="h-6 w-6 rounded-full border-2 border-gray-400 border-t-transparent animate-spin mb-2"></div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

