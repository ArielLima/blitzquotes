import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  useColorScheme,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 64) / 4; // 4 photos per row with padding

interface PhotoItem {
  id?: string;
  uri: string;
  name: string;
  isNew?: boolean;
}

interface Props {
  photos: PhotoItem[];
  onAddPhotos: (photos: { uri: string; name: string }[]) => void;
  onRemovePhoto: (index: number) => void;
  maxPhotos?: number;
  style?: any;
}

export default function PhotoPicker({
  photos,
  onAddPhotos,
  onRemovePhoto,
  maxPhotos = 20,
  style,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [viewingPhoto, setViewingPhoto] = useState<PhotoItem | null>(null);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      onAddPhotos([{
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
      }]);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const remainingSlots = maxPhotos - photos.length;
      if (remainingSlots <= 0) {
        Alert.alert('Limit reached', `Maximum ${maxPhotos} photos allowed`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remainingSlots,
      });

      if (result.canceled || !result.assets?.length) return;

      const newPhotos = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}_${index}.jpg`,
      }));

      onAddPhotos(newPhotos);
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to select photos');
    }
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemovePhoto(index),
        },
      ]
    );
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <View style={[styles.container, style]}>
      {/* Photo Grid */}
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={photo.id || `photo-${index}`}
            style={styles.photoWrapper}
            onPress={() => setViewingPhoto(photo)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            {photo.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemovePhoto(index)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <FontAwesome name="times" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add Photo Button */}
        {canAddMore && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
            onPress={() => {
              Alert.alert(
                'Add Photo',
                'Choose an option',
                [
                  { text: 'Take Photo', onPress: handleTakePhoto },
                  { text: 'Choose from Gallery', onPress: handlePickFromGallery },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <FontAwesome name="plus" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.addButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Add
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photo count */}
      {photos.length > 0 && (
        <Text style={[styles.countText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
          {photos.length} of {maxPhotos} photos
        </Text>
      )}


      {/* Photo Viewer Modal */}
      <Modal
        visible={!!viewingPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.viewerOverlay}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewingPhoto(null)}
          >
            <FontAwesome name="times" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {viewingPhoto && (
            <Image
              source={{ uri: viewingPhoto.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  newBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  countText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    padding: 10,
    zIndex: 1,
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
});
