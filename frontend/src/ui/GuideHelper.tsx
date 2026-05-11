import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

type GuideConfig = {
  message: string;
  imageSrc: string;
  placement: "left" | "right";
  avatarClassName?: string;
  containerClassName?: string;
};

function getGuideConfig(path: string): GuideConfig | null {
  if (path === "/") {
    return {
      message: "Добро пожаловать в аудиогид. Я проведу вас по секретам этого места.",
      imageSrc: "/guide-home.png",
      placement: "right",
    };
  }

  if (path.startsWith("/g/") && path.includes("/points") && !path.includes("/p/")) {
    return {
      message: "Выберите следующую точку маршрута — у нас ещё много интересного.",
      imageSrc: "/guide-character.png",
      placement: "left",
    };
  }

  if (path.startsWith("/g/") && path.includes("/p/")) {
    return {
      message: "Нажмите «play» и давайте послушаем эту историю вместе.",
      imageSrc: "/guide-character.png",
      placement: "left",
    };
  }

  if (path.startsWith("/favorites")) {
    return {
      message: "Здесь живут ваши любимые истории. Можно вернуться к ним в любой момент.",
      imageSrc: "/guide-peek.png",
      placement: "left",
      avatarClassName: "guide-avatar--peek",
      containerClassName: "guide--flush-left",
    };
  }

  if (path.startsWith("/history")) {
    return {
      message: "Немного контекста — так легче почувствовать эпоху и атмосферу.",
      imageSrc: "/guide-character.png",
      placement: "left",
    };
  }

  if (path.startsWith("/reconstruction")) {
    return {
      message: "Передвигайте ползунок и сравнивайте, как менялся облик зданий.",
      imageSrc: "/guide-peek.png",
      placement: "left",
      avatarClassName: "guide-avatar--peek",
      containerClassName: "guide--flush-left",
    };
  }

  return null;
}

export function GuideHelper() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [guideConfig, setGuideConfig] = useState<GuideConfig | null>(null);
  const [justShown, setJustShown] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const popTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
  };

  const scheduleGuide = (config: GuideConfig | null, delayMs: number) => {
    clearTimers();

    if (!config) {
      setGuideConfig(null);
      setVisible(false);
      setJustShown(false);
      return;
    }

    setGuideConfig(config);
    setVisible(false);
    setJustShown(false);

    showTimerRef.current = window.setTimeout(() => {
      setVisible(true);
      setJustShown(true);

      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 9000);

      popTimerRef.current = window.setTimeout(() => {
        setJustShown(false);
      }, 450);
    }, delayMs);
  };

  useEffect(() => {
    scheduleGuide(getGuideConfig(location.pathname), 1000);
    return () => {
      clearTimers();
    };
  }, [location.pathname]);

  useEffect(() => {
    function handleRouteCompleted() {
      scheduleGuide(
        {
          message:
            "Поздравляю, вы прослушали все точки этого маршрута. Спасибо, что прошли весь путь до конца.",
          imageSrc: "/guide-complete.png",
          placement: "right",
        },
        0,
      );
    }

    window.addEventListener("izium-route-completed", handleRouteCompleted);

    return () => {
      window.removeEventListener("izium-route-completed", handleRouteCompleted);
    };
  }, []);

  if (!guideConfig) {
    return null;
  }

  return (
    <div
      className={
        "guide" +
        (guideConfig.containerClassName ? " " + guideConfig.containerClassName : "") +
        (guideConfig.placement === "right" ? " guide--right" : "") +
        (visible ? " guide--visible" : "") +
        (justShown ? " guide--enter" : "")
      }
    >
      <div className={"guide-avatar" + (guideConfig.avatarClassName ? " " + guideConfig.avatarClassName : "")}>
        <img
          src={guideConfig.imageSrc}
          alt="Персонаж-проводник"
        />
      </div>
      <div className="guide-bubble">
        <button
          type="button"
          className="guide-close"
          aria-label="Скрыть подсказку"
          onClick={() => setVisible(false)}
        >
          ×
        </button>
        <div className="guide-text">{guideConfig.message}</div>
      </div>
    </div>
  );
}

