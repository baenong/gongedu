import { useEffect, useState } from "react";
import api from "../api/axios";
import { getErrorMessage } from "../utils/errorUtils";
import toast from "react-hot-toast";
import TextInput from "./TextInput";
import FormLabel from "./FormLabel";
import FormButton from "./FormButton";

const IpAccessSettings = () => {
  const [settings, setSettings] = useState({ ipWhitelist: "" });

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get("/settings");
        setSettings((prev) => ({
          ...prev,
          ipWhitelist: response.data.allowed_ip_range ?? prev.ipWhitelist,
        }));
      } catch (error) {
        toast.error(
          getErrorMessage(error, "설정 로드에 실패했습니다. 서버를 확인하세요"),
        );
      }
    })();
  }, []);

  const handleSave = async (key: string, value: string) => {
    try {
      await api.post("/settings", { key, value });
      toast.success("설정이 저장되었습니다.");
    } catch (error) {
      toast.error(getErrorMessage(error, "설정 저장을 실패했습니다."));
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        IP 설정
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
          <div className="flex-1 w-full">
            <FormLabel>허용 IP 범위 (CIDR 형식)</FormLabel>

            <p className="text-base text-gray-500 dark:text-gray-400 mb-2">
              접속을 허용할 IP 또는 대역(CIDR)을 입력하세요. 쉼표(,)로 구분하여
              여러 개 입력 가능합니다.
              <br />
              (예: <code>192.168.0.0/24, 10.50.10.5</code>) <br />
              <span className="text-red-500 dark:text-red-400">
                * 비어있으면 모든 IP 접속 허용
              </span>
            </p>
            <TextInput
              value={settings.ipWhitelist}
              onChange={(e) =>
                setSettings({ ...settings, ipWhitelist: e.target.value })
              }
              placeholder="예: 192.168.0.0/24"
            />
          </div>
          <FormButton
            onClick={() => handleSave("allowed_ip_range", settings.ipWhitelist)}
            className="px-4 dark:hover:bg-gray-600"
          >
            저장
          </FormButton>
        </div>
      </div>
    </section>
  );
};

export default IpAccessSettings;
