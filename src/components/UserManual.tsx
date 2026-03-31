import React from 'react';
import { BookOpen, X, CheckCircle2, AlertCircle, Key, Upload, Languages, Edit3, Download, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: <Key className="w-5 h-5 text-blue-500" />,
      title: "第一步：配置 API Key",
      content: "点击右上角的 'Settings' 按钮，填入你的 Gemini API Key。这是为了确保翻译功能稳定可用，且不消耗公共额度。你可以点击设置里的链接免费获取。"
    },
    {
      icon: <Upload className="w-5 h-5 text-purple-500" />,
      title: "第二步：上传视频或 SRT",
      content: "1. 将你的视频文件拖入上传区。支持最大 1GB 的视频文件。\n2. 或者直接点击 'Import SRT Only' 按钮，仅上传字幕文件进行翻译。这种模式下不需要视频，适合已有字幕的情况。"
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      title: "第三步：获取原文",
      content: "1. 如果上传了视频，点击 'Start Transcription' 让 AI 自动识别语音。\n2. 或者点击 'Import SRT' 导入你从剪映导出的原始字幕文件。\n3. 如果是 'SRT Only' 模式，字幕会自动加载到编辑器中。"
    },
    {
      icon: <Languages className="w-5 h-5 text-indigo-500" />,
      title: "第四步：一键翻译",
      content: "在下拉菜单中选择目标语言（如：中文、印尼语、葡萄牙语等），点击 'Translate Subtitles'。AI 会保留原始时间轴并进行精准翻译。"
    },
    {
      icon: <Edit3 className="w-5 h-5 text-orange-500" />,
      title: "第五步：校对与微调",
      content: "在编辑器中直接修改文字或时间。你可以点击时间旁边的 'SET' 按钮，将字幕对齐到视频当前播放的位置。视频下方的 'Current Segment Adjuster' 也能帮你快速调整。"
    },
    {
      icon: <Download className="w-5 h-5 text-pink-500" />,
      title: "第六步：导出成果",
      content: "1. 点击 'Download SRT File' 获取字幕文件，直接拖入剪映使用。\n2. 设置好样式，点击 'Generate & Download Video' 直接导出带字幕的视频。如果导出太慢或需要修改，可以点击 'Cancel Export' 随时停止。"
    },
    {
      icon: <Wand2 className="w-5 h-5 text-cyan-500" />,
      title: "开发者：网站接入 (Widget)",
      content: "你可以通过 iframe 将本工具嵌入你的网站：\n\n1. 嵌入代码：\n<iframe src='https://your-app.run.app?mode=widget' width='100%' height='600px'></iframe>\n\n2. 远程控制 (postMessage)：\niframe.contentWindow.postMessage({\n  type: 'LOAD_VIDEO_URL',\n  payload: { url: '视频直链.mp4' }\n}, '*');"
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">字幕翻译 (GlobalSubs AI) 使用说明书</h3>
                <p className="text-xs text-gray-500 font-medium">简单、快速、专业的 AI 视频翻译工具</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="grid grid-cols-1 gap-6">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      {step.icon}
                    </div>
                    {index !== steps.length - 1 && <div className="w-0.5 h-full bg-gray-100 my-2"></div>}
                  </div>
                  <div className="pb-4">
                    <h4 className="text-base font-bold text-gray-900 mb-1">{step.title}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{step.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider">注意事项</h4>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  <li>免费版 API Key 每分钟限制 15 次请求，操作请勿过快。</li>
                  <li>如果视频超过 10 分钟，建议分段处理以保证最佳效果。</li>
                  <li>导出 4K 视频需要较长时间，请保持页面开启。</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
            >
              我知道了，开始使用
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
