import { useEffect, useState } from "react";
import api from "../api/axios";
import { getErrorMessage } from "../utils/errorUtils";
import toast from "react-hot-toast";
import TextInput from "./TextInput";
import FormLabel from "./FormLabel";
import ActionButton from "./ActionButton";

const AiVerificationSettings = () => {
  const [aiSettings, setAiSettings] = useState({
    provider: "openai" as "openai" | "claude" | "local",
    openaiModel: "",
    anthropicModel: "",
    localModel: "",
    openaiApiKey: "",
    anthropicApiKey: "",
    hasOpenaiKey: false,
    hasAnthropicKey: false,
  });
  const [aiModelOptions, setAiModelOptions] = useState<string[]>([]);
  const [loadingAiModels, setLoadingAiModels] = useState(false);

  // provider별로 흩어진 model/apiKey 값을 단일 UI 입력칸에 매핑하기 위한 헬퍼
  const aiModelFieldByProvider = {
    openai: "openaiModel",
    claude: "anthropicModel",
    local: "localModel",
  } as const;
  const currentAiModelField = aiModelFieldByProvider[aiSettings.provider];
  const currentAiModel = aiSettings[currentAiModelField];
  const currentAiApiKey =
    aiSettings.provider === "claude"
      ? aiSettings.anthropicApiKey
      : aiSettings.openaiApiKey;
  const currentAiHasKey =
    aiSettings.provider === "claude"
      ? aiSettings.hasAnthropicKey
      : aiSettings.hasOpenaiKey;

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get("/settings/ai");
        setAiSettings((prev) => ({ ...prev, ...response.data }));
      } catch (error) {
        toast.error(getErrorMessage(error, "AI 설정을 불러올 수 없습니다."));
      }
    })();
  }, []);

  // AI 검증 설정 저장 (API 키 입력란을 비워두면 기존 값을 유지)
  const handleSaveAiSettings = async () => {
    try {
      await api.post("/settings/ai", {
        provider: aiSettings.provider,
        model: currentAiModel,
        apiKey: currentAiApiKey || undefined,
      });
      toast.success("AI 설정이 저장되었습니다.");
      const response = await api.get("/settings/ai");
      setAiSettings((prev) => ({ ...prev, ...response.data }));
    } catch (error) {
      toast.error(getErrorMessage(error, "AI 설정 저장을 실패했습니다."));
    } finally {
      setAiSettings((prev) => ({
        ...prev,
        openaiApiKey: "",
        anthropicApiKey: "",
      }));
    }
  };

  // 현재 입력된(또는 저장된) 키로 provider의 사용 가능한 모델 목록을 조회
  // (local은 API 키가 필요 없으므로 apiKey는 무시된다)
  const handleRefreshAiModels = async () => {
    setLoadingAiModels(true);
    try {
      const response = await api.post("/settings/ai/models", {
        provider: aiSettings.provider,
        apiKey: currentAiApiKey || undefined,
      });
      setAiModelOptions(response.data.models);
      toast.success(`모델 ${response.data.models.length}개를 불러왔습니다.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "모델 목록을 가져오지 못했습니다."));
    } finally {
      setLoadingAiModels(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        AI 수료증 검증 설정
      </h2>
      <p className="text-base text-gray-500 dark:text-gray-400 mb-6">
        여기서 설정한 값이 있으면 우선 사용되고, 비어있으면 서버의 .env 설정을
        그대로 사용합니다. API 키는 저장 후 다시 표시되지 않으며, 입력란을
        비운 채 저장하면 기존 값이 유지됩니다.
      </p>

      <div className="space-y-6">
        <hr className="border-gray-300 dark:border-gray-700" />

        <div className="flex flex-wrap gap-6">
          <div className="max-w-xs w-full">
            <FormLabel>사용할 AI 제공자</FormLabel>
            <div className="flex flex-col gap-2 mt-2">
              {(
                [
                  { value: "openai", label: "OpenAI" },
                  { value: "claude", label: "Claude" },
                  { value: "local", label: "Local LLM (Ollama)" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="ai-provider"
                    checked={aiSettings.provider === option.value}
                    onChange={() => {
                      setAiSettings({ ...aiSettings, provider: option.value });
                      setAiModelOptions([]);
                    }}
                  />
                  <span className="text-base text-gray-800 dark:text-gray-200">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>

            <ActionButton
              onClick={handleRefreshAiModels}
              disabled={loadingAiModels}
              className="mt-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              title={
                aiSettings.provider === "local"
                  ? "서버에 설치된 Ollama 모델 목록 조회"
                  : "입력된(또는 저장된) API 키로 모델 목록 조회"
              }
            >
              {loadingAiModels ? "조회 중..." : "모델목록 호출"}
            </ActionButton>
          </div>

          {aiSettings.provider !== "local" && (
            <div className="max-w-sm w-full">
              <FormLabel>API 키</FormLabel>
              <TextInput
                type="password"
                isRequired={false}
                value={currentAiApiKey}
                onChange={(e) =>
                  setAiSettings({
                    ...aiSettings,
                    [aiSettings.provider === "claude"
                      ? "anthropicApiKey"
                      : "openaiApiKey"]: e.target.value,
                  })
                }
                placeholder={
                  currentAiHasKey
                    ? "설정됨 - 변경하려면 새 키 입력"
                    : "설정되지 않음"
                }
              />
            </div>
          )}

          <div className="max-w-sm w-full">
            <FormLabel>모델</FormLabel>
            <TextInput
              isRequired={false}
              value={currentAiModel}
              onChange={(e) =>
                setAiSettings({
                  ...aiSettings,
                  [currentAiModelField]: e.target.value,
                })
              }
              placeholder={
                aiSettings.provider === "openai"
                  ? "예: gpt-4o (비우면 기본값 사용)"
                  : aiSettings.provider === "claude"
                    ? "예: claude-haiku-4-5 (비우면 기본값 사용)"
                    : "예: qwen2.5vl:3b (비우면 기본값 사용)"
              }
            />
            <div className="mt-2 h-40 overflow-y-auto scrollbar-hide border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
              {aiModelOptions.length > 0 ? (
                aiModelOptions.map((model) => (
                  <button
                    type="button"
                    key={model}
                    onClick={() =>
                      setAiSettings({
                        ...aiSettings,
                        [currentAiModelField]: model,
                      })
                    }
                    className="w-full text-left px-3 py-1.5 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {model}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-base text-gray-400 dark:text-gray-500">
                  "모델목록 호출" 버튼을 누르면 여기에 목록이 표시됩니다.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveAiSettings}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md text-base font-bold transition shadow-sm"
          >
            저장
          </button>
        </div>
      </div>
    </section>
  );
};

export default AiVerificationSettings;
