import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getKeyboardAvoidingBehavior } from '../../src/keyboard';

type Props = ModalProps & {
  children: React.ReactNode;
  backdropStyle?: StyleProp<ViewStyle>;
};

/** Tam ekran / kart modal — TextBoxEditModal, picker overlay vb. */
export function KeyboardAwareModal({
  children,
  backdropStyle,
  transparent = true,
  animationType = 'fade',
  ...modalProps
}: Props) {
  return (
    <Modal transparent={transparent} animationType={animationType} {...modalProps}>
      <KeyboardAvoidingView
        behavior={getKeyboardAvoidingBehavior('modal')}
        style={[styles.backdrop, backdropStyle]}
      >
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
  },
});
