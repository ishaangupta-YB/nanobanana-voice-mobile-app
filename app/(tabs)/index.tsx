import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Voice, {
  SpeechRecognizedEvent,
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

const { width, height } = Dimensions.get('window');

interface VoiceState {
  recognized: string;
  pitch: string;
  error: string;
  end: string;
  started: boolean;
  results: string[];
  partialResults: string[];
}

export default function HomeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>({
    recognized: '',
    pitch: '',
    error: '',
    end: '',
    started: false,
    results: [],
    partialResults: [],
  });

  const isWeb = Platform.OS === 'web';
  const [webRecognition, setWebRecognition] = useState<any>(null);
  const insets = useSafeAreaInsets();

  // Calculate responsive dimensions
  const availableHeight = height - insets.top - insets.bottom;
  const isLandscape = width > height;

  // Responsive image sizing based on orientation and platform
  const imageHeightRatio = isLandscape ? 0.7 : 0.55;
  const imageWidthRatio = isLandscape ? 0.4 : 0.85;

  const imageHeight = Math.min(
    availableHeight * imageHeightRatio,
    isLandscape ? width * 0.6 : width * 1.2
  );
  const imageWidth = Math.min(width * imageWidthRatio, imageHeight * 0.75);

  // Platform-specific adjustments
  const webPadding = isWeb ? Math.max(20, width * 0.02) : 0;

  // Animation values for mic button
  const scaleValue = useMemo(() => new Animated.Value(1), []);
  const opacityValue = useMemo(() => new Animated.Value(1), []);

  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityValue, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scaleValue, opacityValue]);

  const stopPulseAnimation = useCallback(() => {
    scaleValue.stopAnimation();
    opacityValue.stopAnimation();
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacityValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [scaleValue, opacityValue]);

  const onSpeechStart = useCallback((e: any) => {
    console.log('onSpeechStart: ', e);
    setVoiceState(prev => ({ ...prev, started: true }));
    startPulseAnimation();
  }, [startPulseAnimation]);

  const onSpeechRecognized = useCallback((e: SpeechRecognizedEvent) => {
    console.log('onSpeechRecognized: ', e);
    setVoiceState(prev => ({ ...prev, recognized: '√' }));
  }, []);

  const onSpeechEnd = useCallback((e: any) => {
    console.log('onSpeechEnd: ', e);
    setVoiceState(prev => ({ ...prev, end: '√', started: false }));
    stopPulseAnimation();
  }, [stopPulseAnimation]);

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    console.log('onSpeechError: ', e);
    setVoiceState(prev => ({
      ...prev,
      error: JSON.stringify(e.error),
      started: false
    }));
    stopPulseAnimation();
    Alert.alert('Speech Recognition Error', `Error: ${e.error?.message || 'Unknown error'}`);
  }, [stopPulseAnimation]);

  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    console.log('onSpeechResults: ', e);
    if (e.value && e.value.length > 0) {
      setVoiceState(prev => ({ ...prev, results: e.value! }));
      setRecognizedText(e.value[0]);
    }
  }, []);

  const onSpeechPartialResults = useCallback((e: SpeechResultsEvent) => {
    console.log('onSpeechPartialResults: ', e);
    if (e.value) {
      setVoiceState(prev => ({ ...prev, partialResults: e.value! }));
    }
  }, []);

  const onSpeechVolumeChanged = useCallback((e: any) => {
    console.log('onSpeechVolumeChanged: ', e);
    setVoiceState(prev => ({ ...prev, pitch: e.value }));
  }, []);

  useEffect(() => {
    if (isWeb) {
      // Initialize web speech recognition
      if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setVoiceState(prev => ({ ...prev, started: true }));
          startPulseAnimation();
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setRecognizedText(finalTranscript);
            setVoiceState(prev => ({ ...prev, results: [finalTranscript] }));
          }

          if (interimTranscript) {
            setVoiceState(prev => ({ ...prev, partialResults: [interimTranscript] }));
          }
        };

        recognition.onend = () => {
          setVoiceState(prev => ({ ...prev, started: false }));
          stopPulseAnimation();
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setVoiceState(prev => ({ ...prev, started: false, error: event.error }));
          stopPulseAnimation();
          Alert.alert('Speech Recognition Error', `Error: ${event.error}`);
        };

        setWebRecognition(recognition);
      } else {
        Alert.alert(
          'Speech Recognition Not Supported',
          'Your browser does not support speech recognition. Please use Chrome or Safari.'
        );
      }
    } else {
      // Mobile setup
      Voice.onSpeechStart = onSpeechStart;
      Voice.onSpeechRecognized = onSpeechRecognized;
      Voice.onSpeechEnd = onSpeechEnd;
      Voice.onSpeechError = onSpeechError;
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechPartialResults = onSpeechPartialResults;
      Voice.onSpeechVolumeChanged = onSpeechVolumeChanged;

      return () => {
        Voice.destroy().then(Voice.removeAllListeners);
      };
    }
  }, [isWeb, onSpeechStart, onSpeechRecognized, onSpeechEnd, onSpeechError, onSpeechResults, onSpeechPartialResults, onSpeechVolumeChanged, startPulseAnimation, stopPulseAnimation]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const startListening = async () => {
    setVoiceState({
      recognized: '',
      pitch: '',
      error: '',
      started: false,
      results: [],
      partialResults: [],
      end: '',
    });
    setRecognizedText('');

    try {
      if (isWeb) {
        if (webRecognition) {
          webRecognition.start();
        } else {
          Alert.alert('Error', 'Speech recognition not available');
        }
      } else {
        await Voice.start('en-US');
      }
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      Alert.alert('Error', 'Failed to start voice recognition. Please check microphone permissions.');
    }
  };

  const stopListening = async () => {
    try {
      if (isWeb) {
        if (webRecognition) {
          webRecognition.stop();
        }
      } else {
        await Voice.stop();
      }
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };



  const renderSoundWaves = () => {
    const waveCount = Math.min(7, Math.max(5, Math.floor(width / 80)));
    const baseHeight = Math.max(4, height * 0.005);
    const maxHeight = Math.max(40, height * 0.05);

    return (
      <View style={styles.soundWaveContainer}>
        {[...Array(waveCount)].map((_, index) => {
          const animatedHeight = voiceState.started
            ? baseHeight + Math.random() * (maxHeight - baseHeight)
            : baseHeight;

          return (
            <Animated.View
              key={index}
              style={[
                styles.soundWave,
                {
                  height: animatedHeight,
                  backgroundColor: voiceState.started ? '#007AFF' : '#E0E0E0',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={[
      styles.container,
      {
        paddingTop: insets.top + webPadding,
        paddingBottom: insets.bottom + webPadding,
      }
    ]}>
      {/* Image Section */}
      <View style={[
        styles.imageSection,
        {
          height: imageHeight + (isLandscape ? 20 : 40),
          flex: isLandscape ? 0 : undefined,
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.imageContainer,
            !selectedImage && styles.imagePlaceholder,
            { width: imageWidth, height: imageHeight }
          ]}
          onPress={pickImage}
          activeOpacity={0.8}
        >
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.image} />
          ) : (
            <View style={styles.placeholderContent}>
              <Ionicons name="camera" size={Math.min(60, imageWidth * 0.2)} color="#CCCCCC" />
              <Text style={[styles.placeholderText, { fontSize: Math.min(16, imageWidth * 0.04) }]}>
                Tap to upload image
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Text Section */}
      <View style={[
        styles.textSection,
        {
          minHeight: isLandscape ? Math.max(40, height * 0.06) : Math.max(60, height * 0.08),
          maxHeight: isLandscape ? Math.max(80, height * 0.12) : Math.max(120, height * 0.15),
        }
      ]}>
        <Text style={[styles.questionText, { fontSize: Math.min(18, width * 0.045) }]}>
          {recognizedText || (voiceState.partialResults.length > 0 ? voiceState.partialResults[0] : "Can you do my makeup?")}
        </Text>
      </View>

      {/* Voice Controls Section */}
      <View style={[
        styles.voiceSection,
        { height: isLandscape ? Math.max(60, height * 0.08) : Math.max(80, height * 0.1) }
      ]}>
        <TouchableOpacity
          style={styles.micButton}
          onPress={voiceState.started ? stopListening : startListening}
          activeOpacity={0.8}
        >
          <Ionicons
            name="mic"
            size={Math.min(24, width * 0.06)}
            color="#666666"
          />
        </TouchableOpacity>

        {renderSoundWaves()}

        <TouchableOpacity style={styles.keyboardButton}>
          <Ionicons name="keypad" size={Math.min(24, width * 0.06)} color="#666666" />
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={[
        styles.statusSection,
        { height: isLandscape ? Math.max(30, height * 0.04) : Math.max(40, height * 0.05) }
      ]}>
        <Text style={[styles.statusText, { fontSize: Math.min(16, width * 0.04) }]}>
          {voiceState.started ? 'Listening...' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Math.max(20, width * 0.05),
  },
  imageSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Math.max(10, height * 0.02),
  },
  imageContainer: {
    borderRadius: Math.max(12, width * 0.03),
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  imagePlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContent: {
    alignItems: 'center',
    gap: Math.max(10, height * 0.015),
  },
  placeholderText: {
    color: '#CCCCCC',
    fontWeight: '500',
  },
  textSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Math.max(20, width * 0.05),
    minHeight: Math.max(60, height * 0.08),
    maxHeight: Math.max(120, height * 0.15),
  },
  questionText: {
    color: '#333333',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: Math.max(24, height * 0.03),
  },
  voiceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(40, width * 0.1),
    height: Math.max(80, height * 0.1),
  },
  micButton: {
    width: Math.max(50, width * 0.125),
    height: Math.max(50, width * 0.125),
    borderRadius: Math.max(25, width * 0.0625),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soundWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: Math.max(20, width * 0.05),
    height: Math.max(60, height * 0.075),
  },
  soundWave: {
    width: Math.max(4, width * 0.01),
    backgroundColor: '#E0E0E0',
    borderRadius: Math.max(2, width * 0.005),
    marginHorizontal: Math.max(2, width * 0.005),
  },
  keyboardButton: {
    width: Math.max(50, width * 0.125),
    height: Math.max(50, width * 0.125),
    borderRadius: Math.max(25, width * 0.0625),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSection: {
    alignItems: 'center',
    justifyContent: 'center',
    height: Math.max(40, height * 0.05),
    paddingBottom: Math.max(10, height * 0.015),
  },
  statusText: {
    color: '#999999',
    fontWeight: '400',
  },
});
