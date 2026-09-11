import { useState, useEffect } from 'react';
import { torchService } from '../torch/torchService';

export function useTorch() {
  const [torchState, setTorchState] = useState(() => torchService.getStatus());
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = torchService.subscribe((isOn, isBlinking, isHardware) => {
      setTorchState({
        isOn,
        isBlinking,
        isSupported: isHardware,
        hasPermission: torchService.getStatus().hasPermission
      });
    });
    return unsub;
  }, []);

  const requestTorch = async (): Promise<boolean> => {
    setErrorMessage(null);
    const result = await torchService.requestTorchAccess();
    if (!result.supported && result.error) {
      setErrorMessage(result.error);
    }
    return result.supported;
  };

  const turnOn = async () => {
    return await torchService.turnTorchOn();
  };

  const turnOff = async () => {
    return await torchService.turnTorchOff();
  };

  const triggerBlinkSignal = async () => {
    await torchService.blinkThenSolidOn(3, 400);
  };

  return {
    ...torchState,
    permissionModalOpen,
    setPermissionModalOpen,
    errorMessage,
    requestTorch,
    turnOn,
    turnOff,
    triggerBlinkSignal
  };
}
